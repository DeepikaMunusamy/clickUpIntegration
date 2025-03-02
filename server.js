require("dotenv").config();
const express = require("express");
const axios = require("axios");
const app = express();

app.use(express.json());

const CLICKUP_API_KEY = process.env.CLICKUP_API_TOKEN;

app.post("/github-webhook", async (req, res) => {
  const event = req.headers["x-github-event"];
  const payload = req.body;

  if (event === "pull_request") {
    const action = payload.action;
    const pr = payload.pull_request;

    const taskId = extractClickUpTaskId(pr.body);
    if (!taskId) {
      console.log("No ClickUp Task ID found in PR description.");
      return res.status(200).send("No Task ID found.");
    }

    if (action === "closed") {
      const isMerged = pr.merged;
      const newStatus = isMerged ? "Merged" : "Closed";

      try {
        await updateClickUpTaskStatus(taskId, newStatus);
        console.log(`ClickUp task ${taskId} status updated to ${newStatus}.`);
      } catch (error) {
        console.error("Error updating ClickUp task:", {
          message: error.message,
          response: error.response?.data,
          stack: error.stack,
        });
      }
    } else if (action === "opened") {
      try {
        await updateClickUpTaskStatus(taskId, "In Progress");
        console.log(`ClickUp task ${taskId} status updated to In Progress.`);
      } catch (error) {
        console.error("Error updating ClickUp task:", {
          message: error.message,
          response: error.response?.data,
          stack: error.stack,
        });
      }
    }
  }

  if (event === "push") {
    const commits = payload.commits;
    for (const commit of commits) {
      const taskId = extractClickUpTaskId(commit.message);
      if (!taskId) {
        console.log("No ClickUp Task ID found in commit message.");
        continue;
      }

      try {
        await addCommentToClickUpTask(taskId, `New commit: ${commit.message}`);
        console.log(`Commit details added to ClickUp task ${taskId}.`);
      } catch (error) {
        console.error("Error adding comment to ClickUp task:", {
          message: error.message,
          response: error.response?.data,
          stack: error.stack,
        });
      }
    }
  }

  if (event === "pull_request_review") {
    const action = payload.action;
    const review = payload.review;

    const taskId = extractClickUpTaskId(review.body);
    if (!taskId) {
      console.log("No ClickUp Task ID found in Review description.");
      return res.status(200).send("No Task ID found.");
    }

    if (action === "submitted") {
      try {
        await updateClickUpTaskStatus(taskId, "Review");
        console.log(`ClickUp task ${taskId} status updated to Review.`);
      } catch (error) {
        console.error("Error updating ClickUp task:", {
          message: error.message,
          response: error.response?.data,
          stack: error.stack,
        });
      }
    }
  }

  res.status(200).send("Webhook received");
});

function extractClickUpTaskId(text) {
  const regex = /https:\/\/app\.clickup\.com\/t\/([a-zA-Z0-9]+)/;
  const match = text.match(regex);
  return match ? match[1] : null;
}

async function updateClickUpTaskStatus(taskId, status) {
  try {
    const response = await axios.put(
      `https://api.clickup.com/api/v2/task/${taskId}`,
      { status },
      { headers: { Authorization: CLICKUP_API_KEY } }
    );
    console.log("Task status updated:", response.data);
  } catch (error) {
    console.error("Error updating ClickUp task:", {
      message: error.message,
      response: error.response?.data,
      stack: error.stack,
    });
  }
}

async function addCommentToClickUpTask(taskId, comment) {
  try {
    const response = await axios.post(
      `https://api.clickup.com/api/v2/task/${taskId}/comment`,
      { comment_text: comment },
      { headers: { Authorization: CLICKUP_API_KEY } }
    );
    console.log("Comment added:", response.data);
  } catch (error) {
    console.error("Error adding comment to ClickUp task:", {
      message: error.message,
      response: error.response?.data,
      stack: error.stack,
    });
  }
}

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
