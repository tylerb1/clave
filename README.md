# Project Name

Clave: Fast consensus with AI

## About The Project

Trying to get group consensus on:

- planning a party with friends?
- coordinating a family trip?
- dealing with an unfair employer?

With Clave, you can get a read on a group's open-ended opinions quickly. Based on them, you can ask further questions, shortening the feedback loop between polling and acting.

### Built With

- [Svelte](https://svelte.dev/) - A radical new approach to building user interfaces.
- [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework for rapid UI development.
- [Netlify Functions](https://www.netlify.com/products/functions/) - Serverless functions to enhance your web projects.
- [Supabase](https://supabase.io/) - An open source Firebase alternative providing all the backend services you need.

## Getting Started

To get a local copy up and running follow these steps.

### Installation

1. Clone the repo

`git clone https://github.com/tylerb1/clave.git`

2. Install NPM packages

`npm install`

3. [Set up a Netlify project](https://docs.netlify.com/get-started/).

4. [Set up a Supabase database](https://supabase.com/docs/guides/getting-started).

5. Copy following project keys to `.env` file.

```
VITE_PUBLIC_SUPA_URL=<your-supabase-project-url>
VITE_PUBLIC_SUPA_KEY=<your-supabase-project-anon-key>
SUPABASE_SERVICE_ROLE=<your-supabase-project-service-role-key>
OPENAI_API_KEY=<your-openai-api-key>
VITE_EMAIL_REDIRECT_URL=<your-redirect-url-after-users-sign-in>
```

### Development

To run the development server with Netlify functions working locally, install the Netlify CLI and run:

`netlify dev`

To start the development server alone:

`npm run dev`

## Contributing

Contributions are **greatly appreciated**. Fork this project at your leisure.

A few capabilities that would make this project better, off the top of my head:
- Interoperability with other AI services like Huggingface or local LLMs
- Sorting / filtering / organizing the question list
- Summarizing answers in chunks to avoid hitting the input token limits of various AI services

## License

Distributed under the GPL v2 license.