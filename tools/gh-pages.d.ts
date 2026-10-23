declare module 'gh-pages' {
  const ghpages: {
    publish(dir: string, options: { branch?: string; dotfiles?: boolean; message?: string }): Promise<void>;
  };
  export default ghpages;
}
