import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "../client/public")));

app.get("/", (req, res) => {
  res.status(200).sendFile(path.resolve(__dirname, "../client"));
});

app.listen(PORT, () => {
  console.log(`Server is running http://localhost:${PORT}`);
});
