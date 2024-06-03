<script lang="ts">
	import { onMount } from "svelte";
  import { sb } from "../supabase";
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

  /* Initialization */
  storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });
  initializeStores();
  const modalStore = getModalStore();
  const toastStore = getToastStore();

  let potentialRoomName = ""
  let potentialQuestion = ""
  let potentialAnswer = ""
  let roomId = ""
  let roomName = ""
  let currentQuestionIndex = 0
  let questions: any[] = []
  let joinedAnswers = ""
  let isSummarizing = false
  let numAnswersSummarized = 0

  $: currentQuestionSummarizedAnswer = questions[currentQuestionIndex]?.generated_answer || ""
  $: currentQuestionLastNumAnswersSummarized = questions[currentQuestionIndex]?.last_num_answers_summarized || ""
  $: answers = questions[currentQuestionIndex]?.answers?.map((ans: any) => { 
    return {
      text: ans.answer_text,
      question: ans.question_id,
    }
  }) || [];

  /* Set up UI */
  const showToast = (message: string) => {
    const t: ToastSettings = {
      message
    };
    toastStore.trigger(t);
  }

  onMount(async () => {
    roomId = ""
    if (roomId) {
      await joinRoom(roomId)
    }
  })

  /* Start meeting */
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
          last_num_answers_summarized,
          answers (
            id,
            answer_text,
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
      await listenToNewAnswers(roomId)
      await listenToQuestionUpdates(roomId)
    }
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

  /* Listen for updates */
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
              if (!q.answers) {
                q.answers = [msg.new]
              } else {
                q.answers = [...q.answers, msg.new]
              }
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
              return { 
                ...q, 
                generated_answer: msg.new.generated_answer, 
                last_num_answers_summarized: msg.new.last_num_answers_summarized
              }
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
          if (!questions.some((q) => q.id === msg.new.id)) {
            questions = [...questions, msg.new]
          }
        }
      )
      .subscribe()
  }

  /* Add questions */
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

  /* Add answers */
  const submitAnswer = async () => {
    await sb
      .from('answers')
      .insert([{ 
        answer_text: potentialAnswer,
        question_id: questions[currentQuestionIndex].id,
        room_id: roomId,
      }])
    potentialAnswer = ""
    showToast("Answer submitted.")
  }

  const summarizeAnswers = async () => {
    isSummarizing = true
    numAnswersSummarized = answers.length
    joinedAnswers = '\'' + answers.map((ans: any) => ans.text).join('\' \'') + '\''
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_EMAIL_REDIRECT_URL}/.netlify/functions/summarize`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            question: questions[currentQuestionIndex].question_text, 
            joinedAnswers,
          }),
        }
      )
      const response = await resp.json();
      const rawText = response?.content?.trim();
      if (rawText) {
        await sb
          .from('questions')
          .update({ generated_answer: rawText, last_num_answers_summarized: numAnswersSummarized})
          .eq('id', questions[currentQuestionIndex].id);
        showToast("Answers summarized.")
      } else {
        showToast('Error summarizing answers.')
      }
      isSummarizing = false
    } catch (error) {
      showToast('Error summarizing answers.')
      isSummarizing = false
    }
  }

  /* Leave */
  const confirmLeaveRoom = () => {
    const modal: ModalSettings = {
      type: 'confirm',
      title: 'Leave room',
      body: 'Are you sure?',
      response: async (r: boolean) => {
        if (r) {
          roomId = ""
          roomName = ""
          currentQuestionIndex = 0
          questions = []
          joinedAnswers = ""
        }
      },
    };
    modalStore.trigger(modal);
  }

  /* About */
  const showAbout = () => {
    const modal: ModalSettings = {
      type: 'alert',
      title: 'About',
      body: 'Built with <3 by <a class="underline" href="https://github.com/tylerb1/" target="_blank">tylerb1</a>.<br><br>Please consider <a class="underline" href="https://ko-fi.com/tylerb1" target="_blank">donating</a>.',
    };
    modalStore.trigger(modal);
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
          on:keydown={(e) => {
            if (e.key === 'Enter') {
              submitQuestion()
            }
          }}
          placeholder="New question..." 
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
          on:keydown={(e) => {
            if (e.key === 'Enter') {
              joinRoomByName()
            }
          }}
          placeholder="Join a room..."
        />

        <button 
          class="btn btn-sm variant-filled-surface rounded-md" 
          on:click={joinRoomByName}
        >Join</button> 
      </div>
    {/if}

    {#if roomId && questions.length > 0}
      <div class="card p-2">
        <p class="text-left"><strong>{questions[currentQuestionIndex].question_text}</strong></p>

        <div class="flex flex-row mt-4 gap-2">
          <input 
            class="input px-2 rounded-md"
            type="text" 
            bind:value={potentialAnswer} 
            on:keydown={(e) => {
              if (e.key === 'Enter' && potentialAnswer.length >= 1) {
                submitAnswer()
              }
            }}
            placeholder="Your answer..." 
          />

          <button 
            class="btn btn-sm variant-filled-surface rounded-md" 
            on:click={submitAnswer}
            disabled={potentialAnswer.length < 1}
          >Submit</button>
        </div>

        <div class="flex flex-row gap-2 items-center mt-4 justify-between">
          <span class="badge variant-filled">
            {questions[currentQuestionIndex]?.answers?.length || 0} {questions[currentQuestionIndex]?.answers?.length === 1 ? 'answer' : 'answers'}
          </span>

          {#if isSummarizing}
            <span class="loader mr-2"></span>
          {/if}
          <button 
            class="btn btn-sm variant-filled-surface rounded-md" 
            on:click={summarizeAnswers}
            disabled={(questions[currentQuestionIndex]?.answers?.length || 0) < 2}
          >Summarize</button>
        </div>

        {#if currentQuestionSummarizedAnswer}
          <p class="mt-2">
            Answer summarized from {currentQuestionLastNumAnswersSummarized} {currentQuestionLastNumAnswersSummarized === 1 ? 'response' : 'responses'}: <span class="italic">{currentQuestionSummarizedAnswer}</span>
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
</div>
<button class="btn btn-sm font-bold variant-glass-primary top-2 right-2 absolute" on:click={showAbout}>
  ⓘ
</button>

<style>
.loader {
    width: 24px;
    height: 24px;
    border: 5px solid #FFF;
    border-bottom-color: #111827;
    border-radius: 50%;
    display: inline-block;
    box-sizing: border-box;
    animation: rotation 1s linear infinite;
    }

    @keyframes rotation {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
    } 
</style>
