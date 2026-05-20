export type StoryPage = {
  text: string;
  imagePrompt: string;
  imageUrl: string;
  audioUrl?: string | null;
};

export type Story = {
  title: string;
  pages: StoryPage[];
  /** True when voice narration was purchased. Drives the viewer Play/Stop UI
   *  independently of whether ElevenLabs actually returned audio per page. */
  voice?: boolean;
};
