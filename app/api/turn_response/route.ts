import { MODEL } from "@/config/constants";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const { messages, tools } = await request.json();
    console.log("Received messages:", messages);

    const openai = new OpenAI();

    const yearBuiltSchema = {
      type: "object",
      properties: {
        yearBuilt: { type: "number" },
        sourceURL: { type: "string" },
        // confidenceScore: {type: "number"},
        sourceType: {
          type: "string",
          enum: ["Government Website", "Authoritative Real Estate Website (eg Zillow, Redfin)", "Other"]
        },
        deductionType: {
          type: "string",
          enum: ["Explicitly Stated", "High confidence inferral", "Low confidence inferral"]
        },
      },
      required: ["yearBuilt", "sourceURL", "sourceType", "deductionType"],
      additionalProperties: false,
    };
    const constructionTypeSchema = {
      type: "object",
      properties: {
        constructionType: {
          type: "string",
          enum: [
            "Frame",
            "Joisted Masonry",
            "Non-Combustible",
            "Masonry NC",
            "Modified Fire Resistive",
            "Fire Resistive",
            "Mill Construction"
          ]
        },
        sourceURL: { type: "string" },
        confidenceScore: { type: "number" },
        explanation: { type: "string" },
      },
      required: ["constructionType", "sourceURL", "confidenceScore", "explanation"],
      additionalProperties: false,
    };

    const events = await openai.responses.create({
      model: MODEL,
      input: messages,
      tools,
      stream: true,
      parallel_tool_calls: false,
      text: { format: { name: "year_built_extraction", type: "json_schema", "strict": true, "schema": yearBuiltSchema } }
    });

    // Create a ReadableStream that emits SSE data
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of events) {
            // Sending all events to the client
            const data = JSON.stringify({
              event: event.type,
              data: event,
            });
            controller.enqueue(`data: ${data}\n\n`);
          }
          // End of stream
          controller.close();
        } catch (error) {
          console.error("Error in streaming loop:", error);
          controller.error(error);
        }
      },
    });

    // Return the ReadableStream as SSE
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in POST handler:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
