export type StoryPage = {
  text: string;
  imagePrompt: string;
  imageUrl: string;
  audioUrl?: string | null;
};

export type Story = {
  title: string;
  pages: StoryPage[];
};
