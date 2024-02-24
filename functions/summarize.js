import fetch from 'isomorphic-fetch';

export async function handler(event) {
  let question = undefined;
  let answers = undefined;
  const jwt = event.headers.authorization.split(' ')[1]
  if (jwt) {
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
      model: 'gpt-4',
      messages: [
        {
          "role": "system",
          "content": "You are a helpful assistant."
        },
        {
          "role": "user",
          "content": myPrompt
        }
      ],
      temperature: 1,
      max_tokens: 200,
      top_p: 1,
      frequency_penalty: 0.5,
      presence_penalty: 0,
    }),
  };
  try {
    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      openAiConfig,
    );
    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data?.choices?.[0].message),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: `error occured: ${error}`,
    };
  }
}