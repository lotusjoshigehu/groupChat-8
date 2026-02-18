const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function getPrediction(prompt) {

  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const result = await model.generateContent(prompt);
  const response = await result.response;

  return response.text();
}

const predictTyping = async (req, res) => {

  const { text } = req.body;

  const prompt = `
  Suggest 3 short next-word or phrase completions.
  Keep each suggestion under 5 words.
  Text: "${text}"
  `;

  const output = await getPrediction(prompt);

  res.json({ suggestions: output.split("\n").filter(Boolean) });
};

const smartReplies = async (req, res) => {

  const { message } = req.body;

  const prompt = `
  Provide 3 short smart replies to:
  "${message}"
  Keep responses under 10 words.
  Professional but friendly.
  `;

  const output = await getPrediction(prompt);

  res.json({ replies: output.split("\n").filter(Boolean) });
};

module.exports=
{
    predictTyping,
    smartReplies
}
