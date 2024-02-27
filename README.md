# Clave

## About The Project

Clave is a tool for reaching group consensus on any kind of issue involving open-ended answers, such as:
- planning trips
- addressing grievances
- civic engagement

With Clave you can get a read on a group's open-ended opinions quickly. Based on the answers to one question, you can easily ask more, shortening the feedback loop between polling, planning, and acting.

[Live demo](https://useclave.com)

### Built With

- [Svelte](https://svelte.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Netlify Functions](https://www.netlify.com/products/functions/)
- [Supabase](https://supabase.io/)

## Getting Started

### Installation

1. Clone the repo and navigate to it

```
git clone https://github.com/tylerb1/clave.git <your-repo-name>
cd <your-repo-name>
```

2. Install NPM packages

```
npm install
```

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

To start the development server alone, run:

`npm run dev`

## Contributing

Contributions are **greatly appreciated**. Fork this project at your leisure.

A few capabilities that would make this project better, off the top of my head:
- Interoperability with other AI services like Huggingface or local LLMs
- Sorting / filtering / organizing the question list
- Summarizing answers in chunks to avoid hitting the input token limits of various AI services

## License

Distributed under the GPL v2 license.
