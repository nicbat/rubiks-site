declare module "virtual:course-content" {
  const content: {
    courses: any[];
    modules: any[];
    examples: Record<string, any>;
  };
  export default content;
}
