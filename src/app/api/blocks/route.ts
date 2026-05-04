import { NextRequest } from "next/server";
import { getBlocks, addBlock, deleteBlock } from "@/lib/sheets";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const blocks = await getBlocks();
    return Response.json(blocks);
  } catch (error) {
    console.error("GET /api/blocks error:", error);
    return Response.json({ error: "Failed to fetch blocks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthenticated(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "add") {
      const { date, time, duration_minutes, recurring, label } = body;
      if (!date || !time) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }
      const id = await addBlock({
        date,
        time,
        duration_minutes: duration_minutes || 30,
        recurring: !!recurring,
        label: label || "",
      });
      return Response.json({ id });
    }

    if (action === "delete") {
      const { blockId } = body;
      if (!blockId) {
        return Response.json({ error: "Missing blockId" }, { status: 400 });
      }
      const success = await deleteBlock(blockId);
      if (!success) {
        return Response.json({ error: "Block not found" }, { status: 404 });
      }
      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/blocks error:", error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
