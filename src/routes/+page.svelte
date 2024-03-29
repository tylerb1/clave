<script lang="ts">
	import { onMount } from "svelte";
  import { sb } from "../supabase";
  import type { AuthSession } from '@supabase/supabase-js'
  import { 
    storePopup,
    getModalStore,
    getToastStore, 
    Toast,
    initializeStores,
    type ToastSettings, 
    type ModalSettings,
	  Modal,
  } from '@skeletonlabs/skeleton';
  import { nanoid } from 'nanoid'
  import { Copy, CheckCircled } from "radix-icons-svelte";
  import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';

  storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });
  initializeStores();
  const modalStore = getModalStore();
  const toastStore = getToastStore();

  let isAdmin = false
  let potentialEmail = ""
  let potentialRoomName = ""
  let potentialQuestion = ""
  let potentialAnswer = ""
  let roomId = ""
  let roomName = ""
  let currentQuestionIndex = 0
  let questions: any[] = []
  let joinedAnswers = ""
  let email = ""
  let userId = ""
  let session: AuthSession | null = null

  $: userHasAnswered = answers.some((a: any) => a.user === userId)
  $: currentQuestionUserAnswer = answers.find((a: any) => a.user === userId)?.text || ""
  $: currentQuestionSummarizedAnswer = questions[currentQuestionIndex]?.generated_answer || ""
  $: answers = questions[currentQuestionIndex]?.answers?.map((ans: any) => { 
    return {
      text: ans.answer_text,
      user: ans.user_id,
      question: ans.question_id,
    }
  }) || [];

  const showToast = (message: string) => {
    const t: ToastSettings = {
      message
    };
    toastStore.trigger(t);
  }

  onMount(() => {
    sb.auth.getSession().then(async ({ data }) => {
      session = data.session
      userId = session?.user?.id || ""
      email = session?.user?.email || ""
      isAdmin = session?.user.user_metadata.isAdmin
      roomId = session?.user.user_metadata.currentRoomId || ""
      if (roomId) {
        await joinRoom(roomId)
      }
    })
  })

  const handleLogin = async () => {
    try {
      const { error } = await sb.auth.signInWithOtp({ 
        email: potentialEmail,
        options: {
          emailRedirectTo: import.meta.env.VITE_EMAIL_REDIRECT_URL
        }
      })
      if (error) {
        showToast('Please use a valid email.')
      } else {
        showToast('Check your inbox for a login link.')
      }
    } catch (error) {
      showToast('Please use a valid email.')
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

  const confirmLeaveRoom = () => {
    const modal: ModalSettings = {
      type: 'confirm',
      title: 'Leave room',
      body: 'Are you sure?',
      response: async (r: boolean) => {
        if (r) {
          isAdmin = false
          roomId = ""
          roomName = ""
          currentQuestionIndex = 0
          questions = []
          joinedAnswers = ""
          await sb.auth.updateUser({
            data: { currentRoomId: null, isAdmin: false },
          })
        }
      },
    };
    modalStore.trigger(modal);
  }

  const createNewRoom = async () => {
    roomName = nanoid(12)
    const { data, error } = await sb
      .from('rooms')
      .insert([{ name: roomName }])
      .select()
    potentialRoomName = ""
    if (error) {
      showToast('Error creating room. Please try again.')
    } else {
      roomId = data[0].id
      isAdmin = true
      await sb.auth.updateUser({
        data: { currentRoomId: roomId, isAdmin: true, roomsCreated: [roomId] },
      })
      showToast('Room created.')
      await listenToNewAnswers(roomId)
      await listenToQuestionUpdates(roomId)
    }
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
            answer_text,
            user_id,
            question_id
          )
        )
      `)
      .eq('id', id)
    if (error) {
      showToast('Error joining room. Please try again.')
    } else {
      roomName = data[0].name
      questions = data[0].questions
      await sb.auth.updateUser({
        data: { currentRoomId: roomId },
      })
      if (session?.user.user_metadata.roomsCreated?.includes(roomId)) {
        isAdmin = true
      }
      await listenToNewAnswers(roomId)
      await listenToQuestionUpdates(roomId)
    }
  }

  const listenToNewAnswers = async (roomId: string) => {
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
          questions = questions.map((q) => {
            if (q.id === msg.new.question_id) {
              q.answers = [...q.answers, msg.new]
            }
            return q
          })
        }
      )
      .subscribe()
  }

  const listenToQuestionUpdates = async (roomId: string) => {
    await sb
      .channel(`question-changes`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'questions',
          filter: `room_id=eq.${roomId}`,
        },
        (msg) => {
          questions = questions.map((q) => {
            if (q.id === msg.new.id) {
              return { ...q, generated_answer: msg.new.generated_answer }
            }
            return q
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'questions',
          filter: `room_id=eq.${roomId}`,
        },
        (msg) => {
          questions = [...questions, msg.new]
        }
      )
      .subscribe()
  }

  const joinRoomByName = async () => {
    const { data, error } = await sb
      .from('rooms')
      .select('id')
      .eq('name', potentialRoomName)
    if (error) {
      showToast('Error joining room. Please try again.')
    } else {
      roomId = data[0].id
      await joinRoom(roomId)
    }
  }

  const setCurrentQuestion = (i: number) => {
    currentQuestionIndex = i;
  }

  const submitQuestion = async () => {
    const { data, error } = await sb
      .from('questions')
      .insert([{ 
        question_text: potentialQuestion,
        room_id: roomId,
      }])
      .select()
    if (error) {
      showToast('Error submitting question. Please try again.')
    } else if (data) {
      questions = [...questions, data[0]]
      currentQuestionIndex = questions.length - 1
    }
  }

  const submitAnswer = async () => {
    await sb
      .from('answers')
      .insert([{ 
        answer_text: potentialAnswer,
        question_id: questions[currentQuestionIndex].id,
        room_id: roomId,
        user_id: userId,
      }])
    potentialAnswer = ""
    showToast("Answer submitted.")
  }

  const summarizeAnswers = async () => {
    joinedAnswers = '\'' + answers.map((ans: any) => ans.text).join('\' \'') + '\''
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_EMAIL_REDIRECT_URL}/.netlify/functions/summarize`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session!.access_token}`,
          },
          body: JSON.stringify({ 
            question: questions[currentQuestionIndex].question_text, 
            joinedAnswers,
            userId
          }),
        }
      )
      const response = await resp.json();
      const rawText = response?.content?.trim();
      if (rawText) {
        await sb
          .from('questions')
          .update({ generated_answer: rawText })
          .eq('id', questions[currentQuestionIndex].id);
        showToast("Answers summarized.")
      } else {
        showToast('Error summarizing answers.')
      }
    } catch (error) {
      showToast('Error summarizing answers.')
    }
  }
</script>

<Toast 
  position="b" 
  background="variant-filled-surface"
  buttonDismissLabel='✕'
  buttonAction='btn-sm variant-filled-secondary'
  buttonDismiss='rounded-md btn-sm variant-filled'
/>
<Modal />
<div class="grid md:grid-cols-[1fr_2fr_1fr] grid-cols-1 gap-4 p-4">
  <div class="justify-self-center text-center md:col-start-2">
    <h1 class="text-2xl">Clave</h1>
    <p class="text-sm">Fast consensus with AI</p>
  </div>

  {#if userId}
    <div class="flex flex-col gap-2 max-w-48 md:col-start-3 col-start-1 text-right justify-self-end">
      <p class="text-xs">Logged in as: {email}</p>

      <button 
        type="button" 
        class="btn btn-sm variant-filled-surface rounded-md" 
        on:click={confirmSignout}
      >Sign Out</button>
    </div>

    <div class="flex flex-col gap-4 w-full md:col-start-2 col-start-1 justify-self-center">
      {#if roomId}
        <div class="flex flex-row items-center gap-2">
          <p class="text-xs text-left w-min whitespace-nowrap">
            Room: <span id="room-code" class="font-bold text-xs">{roomName}</span>
          </p>

          <button class="variant-outline-surface rounded-md p-2" on:click={() => {
            let roomCodeElement = document.getElementById('room-code');
            if (roomCodeElement) {
              var elem = document.createElement("textarea");
              document.body.appendChild(elem);
              elem.value = roomName;
              elem.select();
              document.execCommand("copy");
              document.body.removeChild(elem);
              showToast("Copied!")
            }
          }}>
            <Copy className="h-2 w-2"/>
          </button>

          <button 
            class="btn btn-sm variant-filled-surface rounded-md" 
            on:click={confirmLeaveRoom}
          >Leave</button>
        </div>

        <div class="flex flex-row gap-2">
          <input 
            class="input px-2 rounded-md"
            type="text" 
            bind:value={potentialQuestion} 
            placeholder="New question" 
          />

          <button 
            class="btn btn-sm variant-filled-surface rounded-md"
            on:click={submitQuestion}
          >Ask</button>
        </div>
      {:else}
        <div class="flex flex-row gap-2">
          <button 
            class="btn btn-sm variant-filled-surface rounded-md" 
            on:click={async () => await createNewRoom()}
          >Create Room</button>

          <input 
            class="input px-2 rounded-md"
            type="text" 
            bind:value={potentialRoomName} 
            placeholder="Join an existing room..."
          />

          <button 
            class="btn btn-sm variant-filled-surface rounded-md" 
            on:click={joinRoomByName}
          >Join</button> 
        </div>
      {/if}

      {#if roomId && isAdmin && questions.length > 0}
        <div class="card p-2">
          <p class="text-left"><strong>{questions[currentQuestionIndex].question_text}</strong></p>

          <div class="flex flex-row gap-2 items-center mt-4 justify-between">
            <span class="badge variant-filled">
              {questions[currentQuestionIndex]?.answers?.length || 0} answers
            </span>

            <button 
              class="btn btn-sm variant-filled-surface rounded-md" 
              on:click={summarizeAnswers}
              disabled={(questions[currentQuestionIndex]?.answers?.length || 0) < 2}
            >Summarize</button>
          </div>

          {#if currentQuestionSummarizedAnswer}
            <p class="mt-4 italic">
              {currentQuestionSummarizedAnswer}
            </p>
          {/if}
        </div>
      {:else if roomId && questions.length > 0}
        <div class="card flex flex-col gap-2 p-2">
          <p><strong>{questions[currentQuestionIndex].question_text}</strong></p>

          {#if userHasAnswered}
            <p>Your answer: <span class="italic">
              {currentQuestionUserAnswer}
            </span></p>
          {:else}
            <div class="flex flex-row gap-2">
              <input 
                class="input px-2 rounded-md"
                type="text" 
                bind:value={potentialAnswer} 
                placeholder="Answer" 
              />

              <button 
                class="btn btn-sm variant-filled-surface rounded-md" 
                on:click={submitAnswer}
                disabled={potentialAnswer.length < 1}
              >Submit</button>
            </div>
          {/if}

          <span class="badge variant-filled w-min mt-1">
            {questions[currentQuestionIndex]?.answers?.length || 0} answers
          </span>

          {#if currentQuestionSummarizedAnswer}
            <p class="mt-2">
              Summarized answer: <span class="italic">{currentQuestionSummarizedAnswer}</span>
            </p>
          {/if}
        </div>
      {/if}
      {#each questions as q, i}
        {#if q.id !== questions[currentQuestionIndex]?.id}
          <button 
            class="card card-hover p-2 flex flex-row gap-2 items-center cursor-pointer"
            on:click={() => setCurrentQuestion(i)}
          >
            <p class="text-xs text-left mr-4">{q.question_text}</p>

            {#if q.generated_answer}
              <CheckCircled class="min-h-6 min-w-6 ml-auto"/>
            {/if}

            <span class="badge variant-filled {q.generated_answer ? '' : 'ml-auto'}">
              {q.answers?.length || 0}
            </span>
          </button>
        {/if}
      {/each}
    </div>
  {:else}
    <form 
      class="justify-self-center md:col-start-2" 
      on:submit|preventDefault={handleLogin}
    >
      <div class="input-group input-group-divider grid-cols-[2fr_1fr] max-w-96 rounded-md">
        <input
          class="input text-sm px-2 rounded-l-md rounded-tr-none rounded-br-none"
          type="email"
          placeholder="Email"
          bind:value={potentialEmail}
        />

        <button 
          type="submit" 
          class="btn btn-md rounded-none rounded-r-md variant-filled-surface text-xs" 
          aria-live="polite" 
        >
          <span>Send login link</span>
        </button>
      </div>
    </form>
  {/if}
</div>


