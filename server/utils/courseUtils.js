// Course mapping cache - maps course names/keywords to course IDs
let courseMappingCache = {};

// Helper function to build course mapping from Canvas course list
export async function buildCourseMapping(externalUserId, composio) {
  try {
    const tools = await composio.tools.get(externalUserId, {
      tools: ["CANVAS_LIST_COURSES"],
    });

    // This would make the actual Canvas API call to get courses
    // For now, using the known course data to build the mapping
    const courseMapping = {
      // Java courses
      java: 61734,
      "java class": 61734,
      "programming methods": 61734,
      cs1: 61734,
      "programming methods java": 61734,
      "cis-255": 61734,

      // Data Structures
      "data structures": 65759,
      ds: 65759,
      cs2: 65759,
      "data structures java": 65759,
      "cis-256": 65759,

      // Computer Architecture
      "computer architecture": 65734,
      "computer arch": 65734,
      "comp arch": 65734,
      assembly: 65734,
      "assembly language": 65734,
      "cis-242": 65734,

      // Object-Oriented Design
      "object oriented": 60178,
      oop: 60178,
      "object oriented design": 60178,
      "program design": 60178,
      "cis-254": 60178,

      // UNIX/Linux
      unix: 60118,
      linux: 60118,
      "unix/linux": 60118,
      "cis-121": 60118,

      // Art History
      art: 58733,
      "art history": 58733,
      "ancient art": 58733,
      "medieval art": 58733,
      "art-101": 58733,

      // Public Speaking
      "public speaking": 61843,
      speaking: 61843,
      communication: 61843,
      "comm-110": 61843,

      // C++ (past course)
      "c++": 50700,
      cpp: 50700,
      "comp-250": 50700,
    };

    courseMappingCache = courseMapping;
    return courseMapping;
  } catch (error) {
    console.error("Error building course mapping:", error);
    return {};
  }
}

// Helper function to detect course from user message and get course ID
export function detectCourseIdFromMessage(message) {
  const lowerMessage = message.toLowerCase();

  console.log("Debug - Course Mapping Cache:", courseMappingCache);
  console.log("Debug - Message:", lowerMessage);

  // Look for course keywords in the message
  for (const [keyword, courseId] of Object.entries(courseMappingCache)) {
    if (lowerMessage.includes(keyword)) {
      console.log("Debug - Found match:", keyword, "->", courseId);
      return { courseId, keyword };
    }
  }

  console.log("Debug - No course match found");
  return null;
}

// Helper function to get assignments for a specific course and find next due
export async function getNextDueAssignment(courseId, externalUserId, composio) {
  try {
    const tools = await composio.tools.get(externalUserId, {
      tools: ["CANVAS_GET_ALL_ASSIGNMENTS"],
    });

    // This would make the actual Canvas API call
    // For now, return a placeholder structure
    return {
      courseId,
      nextDue: null,
      allAssignments: [],
    };
  } catch (error) {
    console.error("Error getting assignments:", error);
    return null;
  }
}
