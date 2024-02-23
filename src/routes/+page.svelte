<script lang="ts">
	import { onMount } from "svelte";
  import { sb } from "../supabase";
  import type { AuthSession } from '@supabase/supabase-js'
  import randomstring from 'randomstring';
  import { 
    storePopup,
    getModalStore,
    getToastStore, 
    type ToastSettings, 
    initializeStores,
	type ModalSettings,
  } from '@skeletonlabs/skeleton';
  import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';

  storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });
  initializeStores();
  const modalStore = getModalStore();
  const toastStore = getToastStore();

  let isAdmin = false
  let potentialRoomName = ""
  let potentialQuestion = ""
  let potentialAnswer = ""
  let roomId = ""
  let roomName = ""
  let currentQuestion: any = null
  let questions: any[] = []
  let joinedAnswers = ""
  let loading = false
  let email = ""
  let userId = ""
  let session: AuthSession | null = null

  const showToast = (message: string) => {
    const t: ToastSettings = {
      message
    };
    toastStore.trigger(t);
  }

  const handleLogin = async () => {
    try {
      loading = true
      const { error } = await sb.auth.signInWithOtp({ 
        email,
        options: {
          emailRedirectTo: import.meta.env.VITE_EMAIL_REDIRECT_URL
        }
      })
      if (error) {
        showToast('Please use a valid email')
      } else {
        showToast('Check your email for a link.')
      }
      email = ""
    } catch (error) {
      showToast('Please use a valid email')
    } finally {
      loading = false
    }
  }

  const confirmSignout = () => {
    const modal: ModalSettings = {
      type: 'confirm',
      title: 'Sign out',
      body: 'Are you sure?',
      response: async (r: boolean) => {
        if (r) {
          session = null
          userId = ""
          await sb.auth.signOut()
        }
      },
    };
    modalStore.trigger(modal);
  }

  const createNewRoom = async () => {
    roomName = randomstring.generate()
    const { data, error } = await sb
      .from('rooms')
      .insert([{ name: roomName }])
    potentialRoomName = ""
    roomId = (data?.[0] as any).id
    isAdmin = true
    await listenToAnswers(roomId)
  }

  const joinRoom = async (room: string) => {
    const { data, error } = await sb
      .from('rooms')
      .select(`
        id,
        name,
        questions (
          id,
          question_text,
          generated_answer,
          answers (
            id,
            answer_text
          )
        )
      `)
      .eq('name', room )
    if (data) {
      console.log(data)
      roomId = data[0].id
      questions = data[0].questions
      currentQuestion = questions?.[0] || null
      await listenToAnswers(roomId)
    }
  }

  const submitQuestion = async () => {
    const { data, error } = await sb
      .from('questions')
      .insert([{ 
        question_text: potentialQuestion,
        room_id: roomId,
      }])
      .select()
    questions.push(data?.[0])
    currentQuestion = questions[questions.length - 1]
  }

  const submitAnswer = async () => {
    await sb
      .from('answers')
      .insert([{ 
        answer_text: potentialAnswer,
        question_id: currentQuestion.id,
        room_id: roomId,
      }])
  }

  const summarizeAnswers = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_EMAIL_REDIRECT_URL}/.netlify/functions/summarize`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ 
            question: currentQuestion.question_text, 
            answers: joinedAnswers
          }),
        }
      )
      const response = await resp.json();
      const rawText = response[0].generated_text.trim();
      await sb
        .from('questions')
        .update({ generated_answer: rawText })
        .eq('question_id', currentQuestion.id);
      showToast("Answers summarized.")
    } catch (error) {
      showToast('Error summarizing answers.')
    }
  }

  onMount(() => {
    sb.auth.getSession().then(async ({ data }) => {
      userId = data.session?.user?.id || ""
      email = data.session?.user?.email || ""
    })
  })

  const listenToAnswers = async (roomId: string) => {
    await sb
      .channel(`answer-changes`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: `answers' : ''}`,
          filter: `room_id=eq.${roomId}`,
        },
        (msg) => {
          console.log(msg)
        }
      )
      .subscribe()
  }
</script>

<form on:submit|preventDefault={handleLogin} class="flex flex-col gap-3">
  <div class="input-group input-group-divider grid-cols-[2fr_1fr]">
    <input
      id="email"
      class="input text-sm"
      type="email"
      placeholder="Email"
      bind:value={email}
    />
    <button 
      type="submit" 
      class="btn btn-md rounded-none variant-filled-surface text-xs" 
      aria-live="polite" 
      disabled={loading}
    >
      <span>Send login link</span>
    </button>
  </div>
</form>

<div class="flex flex-col gap-2">
  <p class="text-xs">{email}</p>
  <button 
    type="button" 
    class="btn btn-sm variant-filled-surface" 
    on:click={confirmSignout}
  >Sign Out</button>
</div>

{#if roomId}
  <p>Room: {roomId}</p>
  <p>{currentQuestion}</p>
{:else}
  <button on:click={async () => await createNewRoom()}>Create Room</button>
  <input type="text" bind:value={potentialRoomName} placeholder="Join an existing room..."/>
  <button on:click={async () => await joinRoom(potentialRoomName)}>Join</button> 
{/if}

{#if roomId && isAdmin}
  {#if currentQuestion}
    <p>{currentQuestion.answers.length} answers collected</p>
    <button on:click={summarizeAnswers}>Summarize answers</button>
  {/if}
  <input type="text" bind:value={potentialQuestion} placeholder="New question" />
  <button on:click={submitQuestion}>Submit</button>
{:else if roomId}
  <input type="text" bind:value={potentialAnswer} placeholder="Answer" />
  <button on:click={submitAnswer}>Submit</button>
  {#each questions as q}
    <p>{q.question_text}</p>
    <button on:click={() => currentQuestion = q}>View question</button>
  {/each}
{/if}


