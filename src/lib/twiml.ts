import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

export function buildDialResponse(
  forwardingNumber: string,
  statusCallbackUrl: string,
  timeout: number = 20
): string {
  const response = new VoiceResponse();
  const dial = response.dial({
    timeout,
    action: statusCallbackUrl,
    method: "POST",
  });
  dial.number(forwardingNumber);
  return response.toString();
}

export function buildIvrResponse(
  gatherUrl: string,
  greeting: string,
  callbackMessage: string,
  complaintMessage: string
): string {
  const response = new VoiceResponse();
  const gather = response.gather({
    numDigits: 1,
    action: gatherUrl,
    method: "POST",
    timeout: 10,
  });
  gather.say({ voice: "alice" }, `${greeting} ${callbackMessage} ${complaintMessage}`);

  // If no input, say goodbye
  response.say({ voice: "alice" }, "We did not receive any input. Goodbye.");
  response.hangup();

  return response.toString();
}

export function buildThankYouResponse(message: string): string {
  const response = new VoiceResponse();
  response.say({ voice: "alice" }, message);
  response.hangup();
  return response.toString();
}

export function buildErrorResponse(): string {
  const response = new VoiceResponse();
  response.say(
    { voice: "alice" },
    "We are sorry, an error occurred. Please try again later."
  );
  response.hangup();
  return response.toString();
}
