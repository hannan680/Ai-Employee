import { useMutation } from "@tanstack/react-query";

const claudeRequest = async (message, previousMessages, onChunk) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/aiChat/claude`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [...previousMessages, message] }),
    }
  );

  if (!response.ok) {
    console.error("Response not OK:", response.status, response.statusText);
    throw new Error("Error with Claude request");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulatedResponse = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || ""; // Keep the last incomplete chunk in the buffer

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "content") {
            accumulatedResponse += data.text;
            onChunk(data.text);
          } else if (data.type === "error") {
            throw new Error(data.message);
          } else if (data.type === "done") {
            // Handle completion if needed
          }
        } catch (error) {
          console.error("Error parsing JSON:", error);
          // Optionally, you might want to skip this chunk or handle the error
        }
      }
    }
  }

  // Process any remaining data in the buffer
  if (buffer.startsWith("data: ")) {
    try {
      const data = JSON.parse(buffer.slice(6));
      if (data.type === "content") {
        accumulatedResponse += data.text;
        onChunk(data.text);
      }
    } catch (error) {
      console.error("Error parsing final JSON:", error);
    }
  }

  return {
    role: "assistant",
    content: [{ type: "text", text: accumulatedResponse }],
  };
};

export const useClaudeRequest = () => {
  return useMutation({
    mutationKey: ["claudeRequest"],
    mutationFn: ({ message, previousMessages, onChunk }) =>
      claudeRequest(message, previousMessages, onChunk),
  });
};
