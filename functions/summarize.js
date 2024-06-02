import fetch from 'isomorphic-fetch';
import 'dotenv';

export async function handler(event) {
  const question = JSON.parse(event.body).question;
  const answers = JSON.parse(event.body).joinedAnswers;
  const myPrompt = `Describe and summarize the following list of answers to the question "${question}" as accurately and concisely as possible: ${answers}`;
  const openAiConfig = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo-0125',
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
      max_tokens: 300,
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
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      },
      body: JSON.stringify(data?.choices?.[0].message),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      },
      body: JSON.stringify(error),
    };
  }
}