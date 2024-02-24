<script lang="ts">
	import { onMount } from "svelte";
  import { sb } from "../supabase";
  import type { AuthSession } from '@supabase/supabase-js'
  import { nanoid } from 'nanoid'
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
  let answers: string[] = []
  let currentQuestionAnswer = ""
  let joinedAnswers = ""
  let loading = false
  let email = ""
  let userId = ""
  let answersCollected = 0
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
    roomName = nanoid()
    const { data, error } = await sb
      .from('rooms')
      .insert([{ name: roomName }])
      .select()
    potentialRoomName = ""
    roomId = (data?.[0] as any).id
    isAdmin = true
    const { data: d2, error: e2 } = await sb.auth.updateUser({
      data: { currentRoomId: roomId, isAdmin: true },
    })
    showToast('Room created.')
    await listenToAnswers(roomId)
  }

  const joinRoom = async (id: string) => {
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
      .eq('id', id)
    if (data?.length) {
      roomId = data[0].id
      roomName = data[0].name
      questions = data[0].questions
      currentQuestion = questions?.[0] || null
      currentQuestionAnswer = currentQuestion?.generated_answer || ""
      answersCollected = currentQuestion.answers?.length || 0
      answers = currentQuestion.answers?.map((a: any) => a.answer_text)
      const { data: d2, error: e2 } = await sb.auth.updateUser({
        data: { currentRoomId: roomId },
      })
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
    questions = [...questions, data?.[0]]
    currentQuestion = questions[questions.length - 1]
  }

  const submitAnswer = async () => {
    await sb
      .from('answers')
      .insert([{ 
        answer_text: potentialAnswer,
        question_id: currentQuestion.id,
        room_id: roomId,
        user_id: userId,
      }])
    showToast("Answer submitted.")
  }

  const summarizeAnswers = async () => {
    joinedAnswers = '\'' + answers.join('\' \'') + '\''
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
      const rawText = response?.content?.trim();
      await sb
        .from('questions')
        .update({ generated_answer: rawText })
        .eq('id', currentQuestion.id);
      currentQuestionAnswer = rawText
      showToast("Answers summarized.")
    } catch (error) {
      showToast('Error summarizing answers.')
    }
  }

  onMount(() => {
    sb.auth.getSession().then(async ({ data }) => {
      userId = data.session?.user?.id || ""
      email = data.session?.user?.email || ""
      isAdmin = !!data.session?.user.user_metadata.isAdmin
      roomId = data.session?.user.user_metadata.currentRoomId || ""
      session = data.session
      if (roomId) {
        await joinRoom(roomId)
      }
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
          table: `answers`,
          filter: `room_id=eq.${roomId}`,
        },
        (msg) => {
          answersCollected += 1
        }
      )
      .subscribe()
  }

  const joinRoomByName = async () => {
    const { data, error } = await sb
      .from('rooms')
      .select('id')
      .eq('name', potentialRoomName)
    if (data?.length) {
      await joinRoom((data[0] as any).id)
    } else {
      showToast('Room not found.')
    }
  }
</script>

{#if userId}
  <div class="flex flex-col gap-2 max-w-32">
    <p class="text-xs">Logged in as: {email}</p>
    <button 
      type="button" 
      class="btn btn-sm variant-filled-surface" 
      on:click={confirmSignout}
    >Sign Out</button>
  </div>

  <div class="flex flex-col gap-2 max-w-48">
    {#if roomId}
      <p>Room: {roomName}</p>
      {#if currentQuestion}
        <p>Current question: {currentQuestion.question_text}</p>
      {/if}
    {:else}
      <div class="flex flex-row gap-2">
        <button 
          class="btn btn-sm variant-filled-surface" 
          on:click={async () => await createNewRoom()}
        >Create Room</button>
        <input 
          class="input"
          type="text" 
          bind:value={potentialRoomName} 
          placeholder="Join an existing room..."
        />
        <button 
          class="btn btn-sm variant-filled-surface" 
          on:click={joinRoomByName}
        >Join</button> 
      </div>
    {/if}

    {#if roomId && isAdmin}
      {#if currentQuestion}
        <div class="flex flex-row gap-2">
          <p>{answersCollected} answers collected</p>
          <button 
            class="btn btn-sm variant-filled-surface" 
            on:click={summarizeAnswers}
          >Summarize answers</button>
        </div>
      {/if}
      {#if currentQuestionAnswer}
        <p>{currentQuestionAnswer}</p>
      {/if}
      <div class="flex flex-row gap-2">
        <input 
          class="input"
          type="text" 
          bind:value={potentialQuestion} 
          placeholder="New question" 
        />
        <button 
          class="btn btn-sm variant-filled-surface"
          on:click={submitQuestion}
        >Submit</button>
      </div>
    {:else if roomId}
      <div class="flex flex-col gap-2">
        <div class="flex flex-row gap-2">
          <input 
            class="input"
            type="text" 
            bind:value={potentialAnswer} 
            placeholder="Answer" 
          />
          <button 
            class="btn btn-sm variant-filled-surface" 
            on:click={submitAnswer}
          >Submit</button>
        </div>
        {#each questions as q}
          <div class="flex flex-row gap-2">
            <p>{q.question_text}</p>
            <button 
              class="btn btn-sm variant-filled-surface" 
              on:click={() => {
                currentQuestion = q
                currentQuestionAnswer = q.generated_answer || ""
              }}
            >View question</button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <form on:submit|preventDefault={handleLogin}>
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
{/if}


