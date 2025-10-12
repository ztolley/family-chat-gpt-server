import { createApp } from "./app";

const app = createApp();
const port = app.get("port") as number;

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
