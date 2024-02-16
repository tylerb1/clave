import fetch from 'isomorphic-fetch';
import { createClient } from '@supabase/supabase-js';
import 'dotenv';
const {
  VITE_PUBLIC_SUPA_URL,
  SUPABASE_SERVICE_ROLE,
} = process.env;
const sb = createClient(VITE_PUBLIC_SUPA_URL, SUPABASE_SERVICE_ROLE);

export async function handler(event) {
  let question = undefined;
  let answers = undefined;
  const userId = JSON.parse(event.body).userId
  const jwt = event.headers.authorization.split(' ')[1]
  if (jwt) {
    const { data } = await sb.auth.getUser(jwt)
    if (data.user.id === userId) {
      question = JSON.parse(event.body).question;
      answers = JSON.parse(event.body).joinedAnswers;
    } else {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Not Authorized (Invalid Token)' }),
      };
    }
    const myPrompt = `Describe and summarize the following list of answers to the question "${question}" as accurately and concisely as possible: ${answers}`;
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
        body: JSON.stringify(data?.choices?.[0].message),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify(error),
      };
    }
  } else {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Not Authorized (Invalid Token)' }),
    };
  }
}