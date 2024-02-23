<script lang="ts">
	import { onMount } from "svelte";
  import { sb } from "../supabase";
  import type { AuthSession } from '@supabase/supabase-js'
  import randomstring from 'randomstring';
  import { 
    storePopup,
    getModalStore,
    AppBar, 
    AppShell, 
    Toast,
    getToastStore, 
    type ToastSettings, 
    initializeStores,
	Modal,
	type ModalSettings,
	ProgressRadial,
	type ModalComponent,
  } from '@skeletonlabs/skeleton';
  import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';

  storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });
  initializeStores();
  const modalStore = getModalStore();
  const toastStore = getToastStore();

  let isGeneratingAnswer = false
  let isAdmin = false
  let potentialRoomName = ""
  let room = ""
  let question = ""
  let questions: any[] = []
  let joinedAnswers = ""
  let loading = false
  let email = ""
  let userId = ""
  let questionId = ""
  let session: AuthSession | null = null

  const showToast = (message: string) => {
    const t: ToastSettings = {
      message,
      classes: 'alef' 
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

  const getProfile = async (id: string) => {
    const { data, error, status } = await sb
      .from('rooms')
      .select(`
        id
      `)
      .eq('id', id)
    if (error && status !== 406) {
      showToast('Couldn\'t get user profile. Please refresh the page, and if the problem persists, email talkkshopp@protonmail.com.')
      return undefined
    } else if (data?.length === 0) {
      showToast('User profile not found. Please refresh the page, and if the problem persists, email talkkshopp@protonmail.com.')
      return undefined
    } else {
      return data
    }
  }

  const createNewRoom = async () => {
    room = randomstring.generate()
    const { data, error } = await sb.rpc('create_room', { name: room })
    potentialRoomName = ""
    isAdmin = true
  }

  const joinRoom = async (roomName: string) => {
    room = roomName
    const { data, error } = await sb.rpc('join_room', { room })
    if (data) {
      // do stuff
    }
  }

  const submitQuestion = () => {
    questions.push(question)
    sb
      .from('questions')
      .insert([{ question_text: question }])
      .eq('room', room)
  }

  const updateSubscription = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_EMAIL_REDIRECT_URL}/.netlify/functions/summarize`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ question, answers: joinedAnswers}),
        }
      )
      const response = await resp.json();
      const rawText = response[0].generated_text.trim();
      await sb
        .from('questions')
        .update({ generated_answer: rawText })
        .eq('question_id', questionId);
      showToast("Answers summarized.")
    } catch (error) {
      showToast('Error updating subscription. Please try again, and if the problem persists, email talkkshopp@protonmail.com.')
    }
  }

  onMount(() => {
    sb.auth.getSession().then(async ({ data }) => {
      userId = data.session?.user?.id || ""
      email = data.session?.user?.email || ""
    })
  })
</script>

<form on:submit|preventDefault={handleLogin} class="flex flex-col gap-3">
  <div class="input-group input-group-divider grid-cols-[2fr_1fr]">
    <input
      id="email"
      class="input text-sm"
      type="email"
      placeholder="Email"
      bind:value="{email}"
    />
    <button 
      type="submit" 
      class="btn btn-md rounded-none variant-filled-surface text-xs" 
      aria-live="polite" 
      disabled="{loading}"
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

{#if room}
  <p>Room: {room}</p>
{:else}
  <button on:click={async () => await createNewRoom()}>Create Room</button>
  <input type="text" bind:value={potentialRoomName} placeholder="Join an existing room..."/>
  <button on:click={async () => await joinRoom(potentialRoomName)}>Join</button> 
{/if}

{#if room && isAdmin}
  <input type="text" bind:value={question} placeholder="Question" />
  <button on:click={submitQuestion}>Submit</button>
{:else if room}
  {#each questions as q}
    <p>{q}</p>
    <input type="text" bind:value={question} placeholder="Answer" />
    <button on:click={submitQuestion}>Submit</button>
  {/each}
{/if}


