/**
 * Evolution API Integration Client for WhatsApp Notifications
 */

interface SendTextOptions {
  number: string;
  text: string;
}

export async function sendWhatsappMessage({ number, text }: SendTextOptions): Promise<{ success: boolean; error?: string }> {
  const apiUrl = import.meta.env.VITE_EVOLUTION_API_URL;
  const apiToken = import.meta.env.VITE_EVOLUTION_API_TOKEN;
  const instanceName = import.meta.env.VITE_EVOLUTION_INSTANCE_NAME;

  // Sanitizar número de telefone (remover tudo que não for número)
  let cleanNumber = number.replace(/\D/g, "");
  
  // Garantir código do país (55 para Brasil)
  if (cleanNumber.length === 11 && (cleanNumber.startsWith("1") || cleanNumber.startsWith("2") || cleanNumber.startsWith("3") || cleanNumber.startsWith("4") || cleanNumber.startsWith("5") || cleanNumber.startsWith("6") || cleanNumber.startsWith("7") || cleanNumber.startsWith("8") || cleanNumber.startsWith("9"))) {
    // Se tem 11 dígitos e não começa com 55, adiciona 55
    cleanNumber = "55" + cleanNumber;
  } else if (cleanNumber.length === 10) {
    // Se tem 10 dígitos (DDD + número sem o 9 extra), adiciona o 55
    cleanNumber = "55" + cleanNumber;
  }

  // Se não estiver configurado, rodar em modo simulação para validação rápida
  if (!apiUrl || !apiToken || !instanceName) {
    console.warn(
      "[Evolution API] WhatsApp Simulation: Credentials not set. Message would have been sent to",
      cleanNumber,
      ":\n",
      text
    );
    // Simular delay de rede
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { success: true };
  }

  try {
    const formattedUrl = `${apiUrl.replace(/\/$/, "")}/message/sendText/${instanceName}`;
    
    const response = await fetch(formattedUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiToken,
      },
      body: JSON.stringify({
        number: cleanNumber,
        text: text,
        delay: 1200,
        linkPreview: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Evolution API] Error response:", errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    console.log("[Evolution API] Message sent successfully to", cleanNumber, data);
    return { success: true };
  } catch (error: any) {
    console.error("[Evolution API] Exception sending WhatsApp:", error);
    return { success: false, error: error?.message || "Unknown error" };
  }
}
