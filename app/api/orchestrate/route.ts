import { NextRequest, NextResponse } from "next/server";
import { callLLM, AGENTS } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { getOrgProviderKey } from "@/lib/db/queries";
import { createAgentRun, createNotification, finishAgentRun } from "@/lib/db/workspace";
import { rateLimit } from "@/lib/rate-limit";
import {
  MAX_CONTEXT_LENGTH,
  MAX_MODEL_LENGTH,
  MAX_PROMPT_LENGTH,
  isNonEmptyString,
  isValidProvider
} from "@/lib/validation";

export const runtime = "nodejs";

// Coordinator mode can trigger up to 3 sequential LLM calls per request, so
// it gets a tighter budget than a single direct-specialist call.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Internal server error during orchestration.";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) {
    return NextResponse.json({ type: "error", message: "Authentication required." }, { status: 401 });
  }

  const { allowed, retryAfterMs } = rateLimit(`orchestrate:${session.user.id}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    return NextResponse.json(
      { type: "error", message: "Rate limit exceeded. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ type: "error", message: "Invalid JSON body." }, { status: 400 });
  }

  const { provider, model, prompt, agentType, context } = body;

  if (!isValidProvider(provider)) {
    return NextResponse.json({ type: "error", message: `Unsupported provider: ${provider}` }, { status: 400 });
  }
  if (!isNonEmptyString(prompt)) {
    return NextResponse.json({ type: "error", message: "prompt is required." }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { type: "error", message: `prompt exceeds the maximum length of ${MAX_PROMPT_LENGTH} characters.` },
      { status: 400 }
    );
  }
  if (context !== undefined && (typeof context !== "string" || context.length > MAX_CONTEXT_LENGTH)) {
    return NextResponse.json(
      { type: "error", message: `context exceeds the maximum length of ${MAX_CONTEXT_LENGTH} characters.` },
      { status: 400 }
    );
  }
  if (typeof model !== "string" || model.length > MAX_MODEL_LENGTH) {
    return NextResponse.json(
      { type: "error", message: `model must be a string of at most ${MAX_MODEL_LENGTH} characters.` },
      { status: 400 }
    );
  }
  if (typeof agentType !== "string" || (agentType !== "coordinator" && !AGENTS[agentType])) {
    return NextResponse.json({ type: "error", message: `Unknown agent type: ${agentType}` }, { status: 400 });
  }

  const activeKey = await getOrgProviderKey(session.organizationId, provider);
  if (!activeKey) {
    return NextResponse.json(
      {
        type: "error",
        message: `Your organization hasn't configured a "${provider}" API key yet. Ask an admin to add it under Settings → Integrations.`
      },
      { status: 400 }
    );
  }

  const organizationId = session.organizationId;
  const userId = session.user.id;
  const run = await createAgentRun({
    organizationId,
    userId,
    agentType: String(agentType),
    provider,
    model,
    prompt: String(prompt)
  });

  const encoder = new TextEncoder();

  interface StreamEvent {
    type: "status" | "agent_result" | "final_result" | "error";
    message?: string;
    content?: string;
    agent?: string;
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: StreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      const completeOk = async (content: string) => {
        await finishAgentRun({
          id: run.id,
          organizationId,
          status: "succeeded",
          resultExcerpt: content
        });
        try {
          await createNotification({
            organizationId,
            userId,
            kind: "Agents",
            title: `Agent run completed · ${agentType}`,
            body: content.slice(0, 180),
            href: "/agents",
            tone: "violet",
            badge: String(agentType)
          });
        } catch {
          // Notification fan-out must not fail the stream.
        }
      };

      const completeErr = async (message: string) => {
        await finishAgentRun({
          id: run.id,
          organizationId,
          status: "failed",
          error: message
        });
      };

      try {
        if (agentType !== "coordinator") {
          const specialist = AGENTS[agentType];
          if (!specialist) {
            throw new Error(`Unknown agent type: ${agentType}`);
          }

          send({ type: "status", message: `Executing ${specialist.name} Agent...` });

          let fullPrompt = prompt as string;
          if (context) {
            fullPrompt = `CONTEXT/INPUT:\n${context}\n\nUSER PROMPT:\n${prompt}`;
          }

          const result = await callLLM(provider, model, activeKey, specialist.systemPrompt, fullPrompt);

          send({ type: "agent_result", agent: agentType, content: result });
          send({ type: "final_result", content: result });
          await completeOk(result);
          controller.close();
          return;
        }

        send({ type: "status", message: "CEO analyzing request intent..." });

        const classificationSystemPrompt = `You are the Coordinator Routing Engine for Nexus AI Engineering OS.
Given the user's prompt, select the single best specialist agent from this list:
- "eng_lead" (for code reviews, bug analysis, refactoring, SOLID reviews, code snippets, git diffs)
- "architecture" (for system design, cloud architecture, diagrams, component design, database/stack decisions)
- "proposal" (for client proposals, pricing, roadmaps, consulting deliverables)
- "research" (for technology trends, developer tools, comparing libraries, migration complexity)
- "documentation" (for generating READMEs, ADRs, Swagger, Confluence pages, runbooks)
- "client_meeting" (for preparing agendas, meeting notes/MOM, email drafts, sprint tasks)
- "knowledge" (for questions that require searching company resources, internal documentation, RFCs)

If the query is general and does not fit one specific specialist, return "none".
Output ONLY the lowercase key (e.g. "eng_lead" or "architecture" or "none"), nothing else. Do not output markdown, punctuation, or spaces.`;

        let classificationResult = "";
        try {
          classificationResult = await callLLM(
            provider,
            model,
            activeKey,
            classificationSystemPrompt,
            prompt as string
          );
          classificationResult = classificationResult.trim().toLowerCase().replace(/['"`]/g, "");
        } catch {
          send({ type: "status", message: `Routing failed, defaulting to general coordination...` });
        }

        let specialistKey = classificationResult;
        if (!AGENTS[specialistKey]) {
          specialistKey = "none";
        }

        let specialistOutput = "";
        if (specialistKey !== "none") {
          const specialist = AGENTS[specialistKey];
          send({
            type: "status",
            message: `CEO routing task to specialist: ${specialist.name} (${specialist.role})...`
          });

          let specialistPrompt = prompt as string;
          if (context) {
            specialistPrompt = `CONTEXT:\n${context}\n\nUSER PROMPT:\n${prompt}`;
          }

          try {
            specialistOutput = await callLLM(
              provider,
              model,
              activeKey,
              specialist.systemPrompt,
              specialistPrompt
            );
            send({
              type: "status",
              message: `Specialist ${specialist.name} completed analysis.`
            });
            send({ type: "agent_result", agent: specialistKey, content: specialistOutput });
          } catch (e: unknown) {
            send({
              type: "status",
              message: `Warning: Specialist execution failed: ${getErrorMessage(e)}. Continuing with CEO synthesis.`
            });
          }
        } else {
          send({
            type: "status",
            message: "CEO processing directly (no specialist routing required)..."
          });
        }

        send({ type: "status", message: "CEO synthesizing final executive response..." });

        const synthesisPrompt = `The user request: "${prompt}"
        
${specialistOutput ? `Specialist Agent (${specialistKey}) findings:\n${specialistOutput}` : ""}
${context ? `Additional Context:\n${context}` : ""}

Please synthesize the final response. Maintain your role as the Chief of Staff (CEO Agent) with 20+ years of experience.
Structure your output precisely as follows:
1. Executive Summary: High-level overview of findings.
2. Technical Details: Substantive engineering explanations.
3. Risks: Identify architectural, security, or implementation risks.
4. Recommendations: Actionable solutions.
5. Next Actions: Recommended next steps.

Make it professional, deep, and production-ready.`;

        const finalResult = await callLLM(
          provider,
          model,
          activeKey,
          AGENTS.coordinator.systemPrompt,
          synthesisPrompt
        );

        send({ type: "final_result", content: finalResult });
        await completeOk(finalResult);
        controller.close();
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        await completeErr(message);
        send({ type: "error", message });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
}
