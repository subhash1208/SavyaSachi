/**
 * VaidyaVaani - Exotel Webhook Handler (Lambda)
 * 
 * This is the entry point for all Exotel calls.
 * For now it just logs what Exotel sends and returns 200 OK.
 * We'll add Transcribe + Bedrock + Polly here in Day 2-3.
 */

exports.handler = async (event) => {
  console.log("=== EXOTEL CALL RECEIVED ===");
  console.log("Headers:", JSON.stringify(event.headers, null, 2));
  console.log("Body:", JSON.stringify(event.body, null, 2));

  // Parse the body Exotel sends
  let callData = {};
  try {
    // Exotel sends form-encoded data
    if (event.body) {
      const params = new URLSearchParams(event.body);
      callData = Object.fromEntries(params.entries());
    }
  } catch (err) {
    console.log("Body parse error:", err.message);
  }

  // Log the important fields Exotel sends
  console.log("=== CALL DETAILS ===");
  console.log("CallSid:", callData.CallSid || "not provided");
  console.log("From:", callData.From || "not provided");
  console.log("To:", callData.To || "not provided");
  console.log("Direction:", callData.Direction || "not provided");
  console.log("DialWhomNumber:", callData.DialWhomNumber || "not provided");
  console.log("digits:", callData.digits || "no digit pressed");
  console.log("====================");

  // Return 200 OK to Exotel
  // This tells Exotel "we received it, all good"
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      status: "received",
      message: "VaidyaVaani webhook working",
      callSid: callData.CallSid,
      digitPressed: callData.digits
    })
  };
};
