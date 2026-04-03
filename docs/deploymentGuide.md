# Deployment Guide

**Region:** only **US East (N. Virginia) — `us-east-1`**.  
**Time:** about 20–30 minutes, mostly waiting for an automated build.

**Goal:** After this guide you will have a working API, Cognito app client, hosted frontend URL, and (after the follow-up steps) a login user and indexed documents so the chat can answer from your files.

Read **[Prerequisites](./prerequisites.md)** first so your account can create the required AWS resources and use Bedrock.

**Resource names in this guide** (for example `bedrock-chatbot-users-development`) assume the default CDK **environment** `development`. If you deploy with another environment (for example `--context environment=prod`), replace **`development`** with that value in Cognito, S3, Bedrock, and Lambda names.

---

## Before you run anything

1. Sign in to the **AWS Console** and set the region in the top bar to **`us-east-1`**.
2. Confirm your IAM identity can create roles, CloudFormation stacks, CodeBuild projects, Amplify apps, and use Bedrock in this account (see prerequisites).
3. Decide **where** you will run commands:
   - **Recommended:** [AWS CloudShell](https://docs.aws.amazon.com/cloudshell/latest/userguide/welcome.html) in **`us-east-1`** — includes **AWS CLI** and **Git**. Nothing to install.
   - **Alternative:** a terminal on your computer with **[AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)** installed and configured (`aws configure`, default region **`us-east-1`**) and **Git** installed.

You **cannot** follow the main steps below without AWS CLI + Git on the machine where you run them.

---

## Main deployment: `deploy.sh` → CodeBuild

**What you are doing:** You run a small script on your side. That script uses the AWS CLI to create/update an IAM role, an Amplify app, and a CodeBuild project, then **starts one CodeBuild job**. That job (not your laptop) runs `cdk deploy`, builds the Next.js app, and uploads it to Amplify. You do **not** need Node.js or CDK installed locally for this path.

### Path A — AWS CloudShell (recommended)

1. In the console, confirm the region is **`us-east-1`**.
2. Open **CloudShell**: click the terminal icon in the top navigation bar. Wait until the prompt appears.
3. Check that the CLI sees your account (optional but useful):

   ```bash
   aws sts get-caller-identity
   ```

   You should see an `Account` and `Arn`. If this fails, fix credentials before continuing.

4. Clone this repository and enter the folder:

   ```bash
   git clone https://github.com/ASUCICREPO/multilingual-RAG-chatbot.git
   cd multilingual-RAG-chatbot
   ```

5. Make the script executable and run it:

   ```bash
   chmod +x ./deploy.sh
   ./deploy.sh
   ```

6. **Wait** until the script exits. Do not close CloudShell while it is streaming logs. The script polls CodeBuild until the job finishes.

### Path B — Your own computer

1. Install **AWS CLI v2** and **Git** if needed.
2. Run `aws configure` and set **default region** to **`us-east-1`**.
3. Run `aws sts get-caller-identity` and confirm it succeeds.
4. Run the same **clone**, **chmod**, and **`./deploy.sh`** commands as in Path A, steps 4–6.

### How you know it worked

- The script prints **`COMPLETE DEPLOYMENT SUCCESSFUL`** (or similar success summary) and a **DEPLOYMENT SUMMARY** block.
- You should see at least: **API Gateway URL**, **Knowledge Base ID**, **User Pool ID**, **User Pool Client ID**, and a **Frontend URL** (Amplify, usually `https://main.<something>.amplifyapp.com`).
- **Copy the frontend URL** — that is where you open the app later.

If the script exits with an error, open the **CodeBuild** console → project **`bedrock-chatbot-deployment`** → select the failed build → **Tail logs** and read the last error lines.

---

## After deployment (do these in order)

The deploy **does not** create login users. Until you add documents and sync, the bot has nothing to retrieve. Follow the order below.

### 1. Create a sign-in user (Cognito)

1. In the console (region **`us-east-1`**), open **Amazon Cognito** → **User pools**.
2. Open the pool named **`bedrock-chatbot-users-development`** (name includes your stack’s environment suffix; if yours differs, pick the pool created by this project’s stack).
3. Go to the **Users** tab → **Create user**.
4. Choose a **username** and **email** (or follow your org’s process). If the app expects a verified email, enable **Mark email address as verified** when creating the user.
5. Set an initial password or send an invitation per your policy. On first login, the app may ask for a **new password** — that is expected.

You need this user before you can log in to the frontend URL from the deploy summary.

### 2. Upload documents (S3)

1. Open **Amazon S3** (region **`us-east-1`**).
2. Open the **document** bucket for this stack. Its name looks like **`bedrock-chatbot-documents-development-<12-digit-account-id>`**.  
   If you are unsure of the exact name, list stack outputs (see [Get stack output values](#get-stack-output-values) below) and use **`DocumentSourceBucketName`**.
3. Open the **`docs/`** prefix (folder). Create **`docs`** if it does not exist.
4. Upload your files (for example PDF, DOCX, TXT, MD) **into `docs/`**, not the bucket root.

### 3. Sync the knowledge base (Bedrock)

Indexing only happens after you start a sync (or ingestion job).

**Option A — Console**

1. Open **Amazon Bedrock** → **Build** → **Knowledge bases** (region **`us-east-1`**).
2. Open **`bedrock-chatbot-kb-development`** (or the KB name from your stack if different).
3. Under **Data source**, select the data source for this stack, then choose **Sync** (wording may be **Start ingestion** / **Sync** depending on console version).
4. Wait until the job shows **Complete** / **Ready** / **Available** — not **In progress**.

**Option B — AWS CLI** (same region)

Replace placeholders using outputs from the next section:

```bash
KB_ID="<KnowledgeBaseId-from-output>"
DS_ID="<DataSourceId-from-output>"

aws bedrock-agent start-ingestion-job \
  --knowledge-base-id "$KB_ID" \
  --data-source-id "$DS_ID" \
  --region us-east-1
```

### 4. Open the app and test

1. In a browser, go to the **frontend URL** from the deploy summary (for example `https://main.<app-id>.amplifyapp.com`).
2. Log in with the Cognito user from step 1.
3. Ask a question that should be answered from your uploaded documents.

---

## Get stack output values

If you lost the printed summary, list CloudFormation outputs for the stack **`BedrockChatbotBackendStack`**:

```bash
aws cloudformation describe-stacks \
  --stack-name BedrockChatbotBackendStack \
  --region us-east-1 \
  --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" \
  --output table
```

Use **`DocumentSourceBucketName`**, **`KnowledgeBaseId`**, **`DataSourceId`**, **`HttpApiUrl`**, **`UserPoolId`**, and **`UserPoolClientId`** as needed.

---

## Optional: deploy without CodeBuild

Only use this if you cannot use `deploy.sh` / CodeBuild. You must install **AWS CLI v2**, **Node.js** (versions consistent with `backend/package.json` and `buildspec.yml`), and the **AWS CDK CLI**, then deploy the CDK stack and build/deploy the frontend yourself (for example `cd backend && npm ci && cdk deploy`, then build the frontend with `NEXT_PUBLIC_*` env vars from stack outputs and publish to Amplify). This is easy to misconfigure; **prefer the CodeBuild path above.**

---

## Remove everything

From a clone of the repo, with AWS CLI configured for **`us-east-1`**:

```bash
chmod +x ./cleanup.sh
./cleanup.sh
```

---

## Quick fixes

| Problem | What to try |
|--------|-------------|
| `iam:CreateRole` or similar denied | Your IAM identity needs permission to create roles and manage CloudFormation in this account. |
| Wrong region | Deploy only in **`us-east-1`**. |
| Model / Bedrock errors | Confirm **[Prerequisites](./prerequisites.md)** and Bedrock access in **`us-east-1`**. |
| Empty or irrelevant answers | Files must be under **`docs/`**, then **Sync** the knowledge base (step 3). |
| Cannot log in | User must exist in the correct user pool; complete **new password** flow if prompted; verify email if your pool requires it. |

More detail: **[Architecture](./architectureDeepDive.md)**, **[User Guide](./userGuide.md)**, **[API](./apiDoc.md)**.
