import {
  anthropic,
  composio,
  DEFAULT_EXTERNAL_USER_ID,
} from "../services/ai.js";
import {
  buildCourseMapping,
  detectCourseIdFromMessage,
} from "../utils/courseUtils.js";

// Course mapping cache - maps course names/keywords to course IDs
let courseMappingCache = {};

// Chat with Claude using Gmail and Canvas
export const chat = async (req, res) => {
  try {
    const { userMessage, conversationHistory = [], userId } = req.body;
    const externalUserId = DEFAULT_EXTERNAL_USER_ID; // Always use the default user ID

    console.log("Debug - Chat request:", {
      userId: userId,
      externalUserId: externalUserId,
      message: userMessage.substring(0, 50) + "...",
    });

    const messageLower = userMessage.toLowerCase();

    console.log(
      "Debug - Conversation history length:",
      conversationHistory.length
    );
    if (conversationHistory.length > 0) {
      console.log(
        "Debug - Last assistant message:",
        conversationHistory
          .filter((msg) => msg.role === "assistant")
          .slice(-1)[0]
          ?.content?.substring(0, 100) + "..."
      );
    }

    // Build course mapping if not already done
    if (Object.keys(courseMappingCache).length === 0) {
      await buildCourseMapping(externalUserId, composio);
    }

    // Check if this is a specific course assignment question
    const courseDetection = detectCourseIdFromMessage(userMessage);
    const isAssignmentQuestion =
      messageLower.includes("assignment") ||
      messageLower.includes("homework") ||
      messageLower.includes("due") ||
      messageLower.includes("deadline");

    // Determine which toolkits to use and apply search filtering
    let tools;
    let enhancedMessage = userMessage;

    // Add context-aware prompting for follow-up questions
    if (conversationHistory.length > 0) {
      const lastAssistantMessage = conversationHistory
        .filter((msg) => msg.role === "assistant")
        .slice(-1)[0];

      if (
        lastAssistantMessage &&
        lastAssistantMessage.content.includes("assignment") &&
        (userMessage.toLowerCase().includes("yes") ||
          userMessage.toLowerCase().includes("more details") ||
          userMessage.toLowerCase().includes("which one") ||
          userMessage.toLowerCase().includes("should i do") ||
          userMessage.toLowerCase().includes("first"))
      ) {
        console.log("Debug - Detected follow-up question about assignments");
        enhancedMessage = `${userMessage}\n\n[CONTEXT: The user is asking for guidance about assignments I just mentioned. I should analyze the due dates and provide specific recommendations about which assignment to prioritize or work on first.]`;
      }
    }

    if (messageLower.includes("gmail") || messageLower.includes("email")) {
      // Gmail-specific tools - include essential Gmail tools
      tools = await composio.tools.get(externalUserId, {
        tools: ["GMAIL_FETCH_EMAILS", "GMAIL_SEND_EMAIL", "GMAIL_GET_PROFILE"],
      });
    } else if (
      messageLower.includes("canvas") ||
      messageLower.includes("course") ||
      messageLower.includes("assignment") ||
      messageLower.includes("discussion") ||
      courseDetection
    ) {
      // Canvas-specific tools
      tools = await composio.tools.get(externalUserId, {
        tools: [
          "CANVAS_LIST_COURSES",
          "CANVAS_GET_SINGLE_COURSE",
          "CANVAS_GET_ALL_ASSIGNMENTS",
          "CANVAS_LIST_ASSIGNMENT_SUBMISSIONS",
          "CANVAS_GET_ASSIGNMENT",
          "CANVAS_LIST_DISCUSSION_TOPICS",
          "CANVAS_LIST_FILES",
          "CANVAS_GET_USER_COURSE_PROGRESS",
          "CANVAS_LIST_QUIZZES_IN_COURSE",
          "CANVAS_LIST_PAGES_FOR_COURSE",
          "CANVAS_GET_CURRENT_USER",
          "CANVAS_LIST_COURSE_USERS",
        ],
      });

      // If this is a discussion question, enhance the message for better efficiency
      if (
        messageLower.includes("discussion") ||
        messageLower.includes("participate")
      ) {
        enhancedMessage = `${userMessage}

[INSTRUCTIONS: Check discussion topics for courses 65734 (Computer Architecture) and 65759 (Data Structures). Use CANVAS_LIST_DISCUSSION_TOPICS for each course. Provide a complete summary of any discussions that require participation, including due dates, point values, and reply requirements.]`;
      }

      // If we detected a specific course and it's an assignment question, enhance the message
      if (courseDetection && isAssignmentQuestion) {
        enhancedMessage = `${userMessage}\n\n[CRITICAL INSTRUCTIONS: The user is asking about assignments for course ID ${courseDetection.courseId} (detected from "${courseDetection.keyword}"). 

ABSOLUTE REQUIREMENTS:
1. You MUST call CANVAS_GET_ALL_ASSIGNMENTS with course_id: ${courseDetection.courseId}
2. You MUST NOT fabricate, calculate, or guess ANY dates
3. You MUST ONLY use actual due dates from Canvas API response
4. If Canvas returns no assignments, say "No assignments found in Canvas for course ${courseDetection.courseId}"
5. If Canvas returns assignments, list ONLY those exact due dates
6. NEVER create date ranges or calculate "next week" yourself
7. NEVER say things like "between [date] and [date]" - these are fabricated

DO NOT ask for more information. DO NOT stop after listing courses. You have the course ID (${courseDetection.courseId}) - use it immediately to fetch assignments and answer the question.]`;
      }
    } else {
      // For general requests, include essential Gmail and Canvas tools
      const gmailTools = await composio.tools.get(externalUserId, {
        tools: ["GMAIL_FETCH_EMAILS", "GMAIL_SEND_EMAIL", "GMAIL_GET_PROFILE"],
      });
      const canvasTools = await composio.tools.get(externalUserId, {
        tools: [
          "CANVAS_LIST_COURSES",
          "CANVAS_GET_ALL_ASSIGNMENTS",
          "CANVAS_LIST_DISCUSSION_TOPICS",
        ],
      });
      tools = [...gmailTools, ...canvasTools];
    }

    // Add current date/time context for time-sensitive queries
    const currentDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const currentTime = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    // Enhanced message with time context for assignment queries
    let finalEnhancedMessage = enhancedMessage;
    if (
      isAssignmentQuestion ||
      messageLower.includes("due") ||
      messageLower.includes("deadline") ||
      messageLower.includes("next week")
    ) {
      finalEnhancedMessage = `${enhancedMessage}

[CRITICAL INSTRUCTIONS - READ CAREFULLY:
Today is ${currentDate} at ${currentTime}.

ABSOLUTE REQUIREMENTS:
1. You MUST call CANVAS_GET_ALL_ASSIGNMENTS to get real assignment data
2. You MUST NOT fabricate, guess, or make up ANY dates
3. You MUST NOT calculate "next week" dates yourself
4. You MUST only use actual due dates from Canvas API responses
5. If Canvas returns no assignments, say "No assignments found in Canvas for this course"
6. If Canvas returns assignments, use ONLY those exact due dates
7. NEVER say things like "between October 26, 2025 and November 1, 2025" - these are fabricated dates

VIOLATION OF THESE RULES WILL RESULT IN INCORRECT INFORMATION BEING PROVIDED TO THE USER.]`;
    }

    // Create system prompt for time-sensitive queries
    const systemPrompt =
      isAssignmentQuestion ||
      messageLower.includes("due") ||
      messageLower.includes("deadline") ||
      messageLower.includes("next week")
        ? `You are a helpful academic assistant. Today is ${currentDate} at ${currentTime}. 

CRITICAL RULES FOR ASSIGNMENT QUERIES:
1. You MUST call Canvas API tools to get real assignment data
2. You MUST NEVER fabricate, calculate, or guess dates
3. You MUST ONLY use actual due dates returned by Canvas API
4. If Canvas returns no assignments, say "No assignments found in Canvas"
5. If Canvas returns assignments, list ONLY those exact due dates
6. NEVER create date ranges like "between X and Y dates"
7. NEVER calculate "next week" yourself - use Canvas data only

VIOLATING THESE RULES PROVIDES FALSE INFORMATION TO STUDENTS.`
        : null;

    const firstRequest = {
      model: "claude-3-5-sonnet-20241022",
      messages: [
        ...conversationHistory,
        { role: "user", content: finalEnhancedMessage },
      ],
      tools,
      max_tokens: 3000,
    };

    if (systemPrompt) {
      firstRequest.system = systemPrompt;
    }

    const first = await anthropic.messages.create(firstRequest);

    const toolResults = await composio.provider.handleToolCalls(
      externalUserId,
      first
    );

    console.log("Debug - Tool results:", toolResults?.length || 0, "results");
    if (toolResults && toolResults.length > 0) {
      console.log(
        "Debug - First tool result:",
        JSON.stringify(toolResults[0], null, 2)
      );
    }

    // Check if this is an assignment query and validate Canvas data
    if (isAssignmentQuestion && toolResults && toolResults.length > 0) {
      const hasCanvasData = toolResults.some(
        (result) =>
          result.content &&
          result.content.some(
            (content) =>
              content.type === "tool_result" &&
              content.content &&
              (content.content.includes("CANVAS_GET_ALL_ASSIGNMENTS") ||
                content.content.includes("assignment") ||
                content.content.includes("due_date"))
          )
      );

      // Debug logging removed - Canvas data check working correctly

      if (!hasCanvasData) {
        console.log(
          "Warning: Assignment query but no Canvas assignment data found in tool results"
        );
      }
    }

    if (!toolResults || toolResults.length === 0) {
      // If this was an assignment question but no tool results, add a warning
      if (isAssignmentQuestion) {
        const warningResponse = await anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          system: `You are a helpful academic assistant. Today is ${currentDate} at ${currentTime}. 

CRITICAL: No Canvas data was retrieved. You MUST NOT fabricate any dates or assignments.`,
          messages: [
            ...conversationHistory,
            { role: "user", content: finalEnhancedMessage },
            { role: "assistant", content: first.content },
            {
              role: "user",
              content:
                "WARNING: No Canvas assignment data was retrieved. You must respond that no assignment data is available from Canvas and you cannot provide due dates without this data.",
            },
          ],
          max_tokens: 1000,
        });
        return res.json({
          ok: true,
          result: warningResponse,
          noCanvasData: true,
        });
      }
      return res.json({ ok: true, result: first });
    }

    // Check if this is an assignment question but we only got course data (not assignment data)
    if (isAssignmentQuestion && toolResults && toolResults.length > 0) {
      const hasAssignmentData = toolResults.some(
        (result) =>
          result.content &&
          result.content.some(
            (content) =>
              content.type === "tool_result" &&
              content.content &&
              (content.content.includes("CANVAS_GET_ALL_ASSIGNMENTS") ||
                content.content.includes("assignment") ||
                content.content.includes("due_date"))
          )
      );

      const hasCourseData = toolResults.some(
        (result) =>
          result.content &&
          result.content.some(
            (content) =>
              content.type === "tool_result" &&
              content.content &&
              (content.content.includes("course_code") ||
                content.content.includes("course_id"))
          )
      );

      // Debug logging removed - assignment data check working correctly

      // If we have course data but no assignment data, don't return early - continue to assignment fetching
      if (!hasAssignmentData && hasCourseData) {
        // Continuing to assignment fetching logic
        // Don't return early - let the code continue to the assignment fetching logic
      } else if (!hasAssignmentData && !hasCourseData) {
        // Only return early if we have neither course nor assignment data
        const warningResponse = await anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          system: `You are a helpful academic assistant. Today is ${currentDate} at ${currentTime}. 

CRITICAL: No Canvas data was retrieved. You MUST NOT fabricate any dates or assignments.`,
          messages: [
            ...conversationHistory,
            { role: "user", content: finalEnhancedMessage },
            { role: "assistant", content: first.content },
            {
              role: "user",
              content:
                "WARNING: No Canvas assignment data was retrieved. You must respond that no assignment data is available from Canvas and you cannot provide due dates without this data.",
            },
          ],
          max_tokens: 1000,
        });
        return res.json({
          ok: true,
          result: warningResponse,
          noCanvasData: true,
        });
      }
    }

    // Check if this was an assignment question and we only got course list
    const hasCourseData = toolResults.some(
      (result) =>
        result.content &&
        result.content.some(
          (content) =>
            content.type === "tool_result" &&
            content.content &&
            (content.content.includes("CANVAS_LIST_COURSES") ||
              content.content.includes("course_code") ||
              content.content.includes("course_id"))
        )
    );

    const hasAssignmentData = toolResults.some(
      (result) =>
        result.content &&
        result.content.some(
          (content) =>
            content.type === "tool_result" &&
            content.content &&
            content.content.includes("CANVAS_GET_ALL_ASSIGNMENTS")
        )
    );

    // Debug logging removed - assignment continuation check working correctly

    const shouldContinueWithAssignments =
      courseDetection &&
      isAssignmentQuestion &&
      hasCourseData &&
      !hasAssignmentData;

    // Check if this was a discussion question and we only got course list
    const shouldContinueWithDiscussions =
      (messageLower.includes("discussion") ||
        messageLower.includes("participate")) &&
      toolResults.some(
        (result) =>
          result.content &&
          result.content.some(
            (content) =>
              content.type === "tool_result" &&
              content.content &&
              content.content.includes("response_data") &&
              content.content.includes("course_code")
          )
      ) &&
      !toolResults.some(
        (result) =>
          result.content &&
          result.content.some(
            (content) =>
              content.type === "tool_result" &&
              content.content &&
              (content.content.includes("discussion") ||
                content.content.includes("topic"))
          )
      );

    if (shouldContinueWithAssignments) {
      console.log(
        "AI stopped after listing courses, forcing assignment fetch..."
      );

      // Create a follow-up message to force assignment fetching
      const followUpMessage = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        system: `You are a helpful academic assistant. Today is ${currentDate} at ${currentTime}. 

CRITICAL RULES:
1. You MUST call CANVAS_GET_ALL_ASSIGNMENTS to get real data
2. You MUST NEVER fabricate, calculate, or guess dates
3. You MUST ONLY use actual due dates from Canvas API
4. If no assignments found, say "No assignments found in Canvas"
5. NEVER create date ranges or calculate "next week" yourself`,
        messages: [
          ...conversationHistory,
          { role: "user", content: userMessage },
          { role: "assistant", content: first.content },
          ...toolResults,
          {
            role: "user",
            content: `I need you to use CANVAS_GET_ALL_ASSIGNMENTS with course_id: ${courseDetection.courseId} RIGHT NOW to get the assignments and tell me when my next assignment is due. Use ONLY the actual due dates from Canvas - do not fabricate any dates.`,
          },
        ],
        tools,
        max_tokens: 2000,
      });

      const followUpToolResults = await composio.provider.handleToolCalls(
        externalUserId,
        followUpMessage
      );

      if (followUpToolResults && followUpToolResults.length > 0) {
        const finalResponse = await anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          system: `You are a helpful academic assistant. Today is ${currentDate} at ${currentTime}. 

CRITICAL RULES:
1. You MUST use ONLY actual due dates from Canvas API
2. You MUST NEVER fabricate, calculate, or guess dates
3. If no assignments found, say "No assignments found in Canvas"
4. NEVER create date ranges or calculate "next week" yourself`,
          messages: [
            ...conversationHistory,
            { role: "user", content: userMessage },
            { role: "assistant", content: first.content },
            ...toolResults,
            {
              role: "user",
              content: `I need you to use CANVAS_GET_ALL_ASSIGNMENTS with course_id: ${courseDetection.courseId} RIGHT NOW to get the assignments and tell me when my next assignment is due. Use ONLY the actual due dates from Canvas - do not fabricate any dates.`,
            },
            { role: "assistant", content: followUpMessage.content },
            ...followUpToolResults,
          ],
          max_tokens: 2000,
        });

        return res.json({
          ok: true,
          result: finalResponse,
          toolResults: [...toolResults, ...followUpToolResults],
          forcedAssignmentFetch: true,
        });
      }
    }

    if (shouldContinueWithDiscussions) {
      console.log(
        "AI stopped after listing courses, forcing discussion fetch..."
      );

      // Create a follow-up message to force discussion fetching
      const followUpMessage = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        system: `You are a helpful academic assistant. Today is ${currentDate} at ${currentTime}. Use ONLY real Canvas data.`,
        messages: [
          {
            role: "user",
            content: `Check discussion topics for course 65734 (Computer Architecture) and course 65759 (Data Structures). Use CANVAS_LIST_DISCUSSION_TOPICS for each course.`,
          },
        ],
        tools,
        max_tokens: 2000,
      });

      const followUpToolResults = await composio.provider.handleToolCalls(
        externalUserId,
        followUpMessage
      );

      if (followUpToolResults && followUpToolResults.length > 0) {
        const finalResponse = await anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          system: `You are a helpful academic assistant. Today is ${currentDate} at ${currentTime}. Use ONLY real Canvas data.`,
          messages: [
            {
              role: "user",
              content: `Based on the discussion data I just retrieved, provide a complete summary of all discussions that require participation. Include:
1. Course name and ID
2. Discussion title
3. Due date
4. Point value
5. Participation requirements
6. Current status (active/locked)
7. Reply requirements

Format this as a clear, organized response for a student.`,
            },
            { role: "assistant", content: followUpMessage.content },
            ...followUpToolResults,
          ],
          max_tokens: 3000,
        });

        return res.json({
          ok: true,
          result: finalResponse,
          toolResults: [...toolResults, ...followUpToolResults],
          forcedDiscussionFetch: true,
        });
      }
    }

    const followUpRequest = {
      model: "claude-3-5-sonnet-20241022",
      messages: [
        ...conversationHistory,
        { role: "user", content: userMessage },
        { role: "assistant", content: first.content },
        ...toolResults,
      ],
      max_tokens: 3000,
    };

    if (systemPrompt) {
      followUpRequest.system = systemPrompt;
    }

    const followUp = await anthropic.messages.create(followUpRequest);

    res.json({ ok: true, result: followUp, toolResults });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};
