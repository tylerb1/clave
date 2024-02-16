<script lang="ts">
	import { onMount } from "svelte";
  import { sb } from "../supabase";

  let generatingAnswer = false
  let question = ""
  let joinedAnswers = ""
  let timerInterval: any = null
  let timer: any = null;

  const getGeneratedAnswer = async () => {
    generatingAnswer = true
    const resp = await fetch(
		  "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",
      {
        headers: { 
          Authorization: `Bearer ${import.meta.env.VITE_PUBLIC_HF_KEY}`, 
          "Content-Type": "application/json" 
        },
        method: "POST",
        body: JSON.stringify({
          "parameters": {
            "repetition_penalty": 1.2,
            "temperature": 0.5,
            "max_new_tokens": 64
          },
          "inputs": `Describe and summarize these answers to the question "${question}" as accurately and concisely as possible. ${joinedAnswers}`
        }),
      }
    );
    const response = await resp.json();
    const rawText = response[0].generated_text.trim();
    if (rawText) {
      generatingAnswer = false
      const { error } = await sb
        .from(`messages`)
        .insert([{ 
          from_user: userId, 
          to_room: roomId, 
          payload: { 
            seed,
            text: prompt,
            isPrompt: true
          }
        }])
      if (error) {
        console.log(error)
      }
    }
  }

  const startTimer = () => {
    timerInterval = setInterval(() => {
      if (timer > 0) {
        timer--;
      } else {
        clearInterval(timerInterval);
      }
    }, 1000);
  }

  onMount(() => {
    clearInterval(timerInterval);
  });
</script>

<button on:click={getPrompt}>Create Room</button>

{#if generatingPrompt}
  <p>Auto-generated text slug: {prompt}</p>
  <input type="text" bind:value={question} placeholder="Question" />
  <button on:click={startTimer}>Start Timer</button>

  {#if timer > 0}
    <p>Timer: {timer} seconds</p>
  {:else}
    <p>Result</p>
  {/if}
{/if}


