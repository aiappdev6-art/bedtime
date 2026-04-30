export type StoryPage = {
  text: string;
  imagePrompt: string;
  imageUrl: string;
};

export type Story = {
  title: string;
  pages: StoryPage[];
};
