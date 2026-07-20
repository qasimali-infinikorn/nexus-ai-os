import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getClientKey, rateLimit } from "@/lib/rate-limit";
import {
  MAX_KNOWLEDGE_CONTENT_BYTES,
  MAX_KNOWLEDGE_NAME_LENGTH,
  MAX_KNOWLEDGE_QUERY_LENGTH
} from "@/lib/validation";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const RESOLVED_KNOWLEDGE_DIR = path.resolve(KNOWLEDGE_DIR);

const READ_RATE_LIMIT = 60;
const WRITE_RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Ensure the directory exists
function ensureDir() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }
}

// Resolves a user-supplied filename to a path guaranteed to sit directly
// inside KNOWLEDGE_DIR, or null if the name is empty/invalid or would
// otherwise escape the directory (e.g. "." or ".." surviving basename()).
function resolveSafeKnowledgePath(rawName: unknown, sanitize: boolean): string | null {
  if (typeof rawName !== "string" || !rawName.trim()) return null;
  if (rawName.length > MAX_KNOWLEDGE_NAME_LENGTH) return null;

  let safeName = path.basename(rawName);
  if (sanitize) {
    safeName = safeName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  }
  if (!safeName || safeName === "." || safeName === "..") return null;

  const filePath = path.resolve(KNOWLEDGE_DIR, safeName);
  if (path.dirname(filePath) !== RESOLVED_KNOWLEDGE_DIR) return null;

  return filePath;
}

function checkRateLimit(req: Request, bucket: "read" | "write", limit: number): NextResponse | null {
  const clientKey = getClientKey(req);
  const { allowed, retryAfterMs } = rateLimit(`knowledge:${bucket}:${clientKey}`, limit, RATE_WINDOW_MS);
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    );
  }
  return null;
}

// GET: List all files in the knowledge directory
export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, "read", READ_RATE_LIMIT);
  if (limited) return limited;

  try {
    ensureDir();
    const files = fs.readdirSync(KNOWLEDGE_DIR);
    const fileList = files
      .filter((file) => !file.startsWith("."))
      .map((file) => {
        const filePath = path.join(KNOWLEDGE_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          sizeBytes: stats.size,
          updatedAt: stats.mtime.toISOString()
        };
      });

    return NextResponse.json({ success: true, files: fileList });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Handles add file, delete file, and query search
export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, "write", WRITE_RATE_LIMIT);
  if (limited) return limited;

  try {
    ensureDir();
    const body = await req.json();
    const { action } = body;

    if (action === "add") {
      const { name, content } = body;
      if (typeof content !== "string") {
        return NextResponse.json({ success: false, error: "Invalid filename or content" }, { status: 400 });
      }
      if (Buffer.byteLength(content, "utf8") > MAX_KNOWLEDGE_CONTENT_BYTES) {
        return NextResponse.json(
          { success: false, error: `Content exceeds the maximum size of ${MAX_KNOWLEDGE_CONTENT_BYTES} bytes.` },
          { status: 400 }
        );
      }

      const filePath = resolveSafeKnowledgePath(name, true);
      if (!filePath) {
        return NextResponse.json({ success: false, error: "Invalid filename" }, { status: 400 });
      }

      fs.writeFileSync(filePath, content, "utf8");
      return NextResponse.json({ success: true, message: `File ${path.basename(filePath)} created/updated successfully.` });
    }

    if (action === "delete") {
      const { name } = body;
      const filePath = resolveSafeKnowledgePath(name, false);
      if (!filePath) {
        return NextResponse.json({ success: false, error: "Filename is required" }, { status: 400 });
      }

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return NextResponse.json({ success: true, message: `File ${path.basename(filePath)} deleted.` });
      } else {
        return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
      }
    }

    if (action === "search") {
      const { query } = body;
      if (!query || typeof query !== "string") {
        return NextResponse.json({ success: true, context: "", matches: [] });
      }
      if (query.length > MAX_KNOWLEDGE_QUERY_LENGTH) {
        return NextResponse.json(
          { success: false, error: `query exceeds the maximum length of ${MAX_KNOWLEDGE_QUERY_LENGTH} characters.` },
          { status: 400 }
        );
      }

      const files = fs.readdirSync(KNOWLEDGE_DIR).filter((file) => !file.startsWith("."));
      const matches: { filename: string; relevance: number; snippet: string }[] = [];
      let combinedContext = "";

      const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

      for (const file of files) {
        const filePath = path.join(KNOWLEDGE_DIR, file);
        const content = fs.readFileSync(filePath, "utf8");

        // Calculate a simple keyword relevance score
        let relevanceScore = 0;
        if (queryTerms.length > 0) {
          const lowerContent = content.toLowerCase();
          queryTerms.forEach((term) => {
            const matchesCount = (lowerContent.match(new RegExp(escapeRegExp(term), "g")) || []).length;
            relevanceScore += matchesCount;
          });
        }

        // If no specific keyword terms matched, give it a tiny score if file isn't empty
        if (relevanceScore === 0 && content.length > 10) {
          relevanceScore = 0.1; 
        }

        if (relevanceScore > 0) {
          // Extract a snippet
          const snippet = content.slice(0, 300) + (content.length > 300 ? "..." : "");
          matches.push({ filename: file, relevance: relevanceScore, snippet });
          
          combinedContext += `--- DOCUMENT: ${file} ---\n${content}\n\n`;
        }
      }

      // Sort by relevance descending
      matches.sort((a, b) => b.relevance - a.relevance);

      return NextResponse.json({
        success: true,
        context: combinedContext.trim(),
        matches
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
