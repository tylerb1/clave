import fetch from 'isomorphic-fetch';

export async function handler(event) {
  let question = undefined;
  let answers = undefined;
  const jwt = event.headers.authorization.split(' ')[1]
  if (jwt) {
    console.log(event.body);
    question = JSON.parse(event.body).question;
    answers = JSON.parse(event.body).answers;
  } else {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Not Authorized (Invalid Token)' }),
    };
  }

  const myPrompt = `Describe and summarize the following list of answers to the question "${question}" as accurately, comprehensively, and concisely as possible: ${answers}`;

  const openAiConfig = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-curie-001',
      prompt: myPrompt,
      temperature: 1,
      max_tokens: 100,
      top_p: 1,
      frequency_penalty: 0.5,
      presence_penalty: 0,
    }),
  };
  try {
    const response = await fetch(
      'https://api.openai.com/v1/completions',
      openAiConfig,
    );
    const data = await response.json();
    console.log("data:")
    console.log(data)
    return {
      statusCode: 200,
      body: data,
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: `error occured: ${error}`,
    };
  }
}