import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

function playOrSay(
  node: any,
  message: string,
  audioUrl?: string | null
) {
  if (audioUrl) {
    node.play(process.env.NEXT_PUBLIC_APP_URL + audioUrl);
  } else {
    node.say({ voice: "alice" }, message);
  }
}

export function buildIvrResponse(
  gatherUrl: string,
  businessName: string,
  ivrAudioUrl?: string | null,
  noInputAudioUrl?: string | null
): string {
  const response = new VoiceResponse();
  const gather = response.gather({
    numDigits: 1,
    action: gatherUrl,
    method: "POST",
    timeout: 10,
  });

  playOrSay(
    gather,
    `You have reached ${businessName}. We could not take your call. Press 1 to receive a booking link by text. By pressing 1, you agree to receive that message. Press 2 to request a callback.`,
    ivrAudioUrl
  );

  // If no input, say goodbye
  playOrSay(
    response,
    "We did not receive any input. Goodbye.",
    noInputAudioUrl
  );
  response.hangup();

  return response.toString();
}

export function buildThankYouResponse(
  message: string,
  audioUrl?: string | null
): string {
  const response = new VoiceResponse();
  playOrSay(response, message, audioUrl);
  response.hangup();
  return response.toString();
}

export function buildErrorResponse(audioUrl?: string | null): string {
  const response = new VoiceResponse();
  playOrSay(
    response,
    "We are sorry, an error occurred. Please try again later.",
    audioUrl
  );
  response.hangup();
  return response.toString();
}
