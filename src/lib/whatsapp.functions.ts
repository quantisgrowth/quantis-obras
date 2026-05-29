import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  number: z.string().min(8).max(20),
  text: z.string().min(1).max(4000),
});

export const sendWhatsappMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiToken = process.env.EVOLUTION_API_TOKEN;
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

    let cleanNumber = data.number.replace(/\D/g, "");
    if (cleanNumber.length === 11) cleanNumber = "55" + cleanNumber;
    else if (cleanNumber.length === 10) cleanNumber = "55" + cleanNumber;

    if (!apiUrl || !apiToken || !instanceName) {
      console.warn("[Evolution API] Simulation mode — credentials not set. Would send to", cleanNumber);
      return { success: true, simulated: true };
    }

    try {
      const url = `${apiUrl.replace(/\/$/, "")}/message/sendText/${instanceName}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiToken },
        body: JSON.stringify({ number: cleanNumber, text: data.text, delay: 1200, linkPreview: true }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Evolution API] Error:", response.status, errorText);
        return { success: false, error: `HTTP ${response.status}` };
      }
      return { success: true };
    } catch (error) {
      console.error("[Evolution API] Exception:", error);
      return { success: false, error: "Network error" };
    }
  });