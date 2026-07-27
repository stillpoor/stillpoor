import { NextResponse } from "next/server";

import {
  supabaseAdmin,
} from "../../lib/supabase/serverClient";

export async function GET() {
  const {
    count,
    error,
  } = await supabaseAdmin
    .from("blocks")
    .select("*", {
      count: "exact",
      head: true,
    });

  if (error) {
    console.error(
      "Supabase health check failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    blockCount: count,
  });
}