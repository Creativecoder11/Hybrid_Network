# Production Deployment — Hostinger (Cloud/Business hosting, hPanel)

Target setup:
- **admin.yourdomain.com** — admin portal only
- **customer.yourdomain.com** — customer portal only
- **MongoDB Atlas** — managed database, same cluster used by both
- Both subdomains run the **same codebase**, as two separate Node.js
  applications in hPanel, told apart by one environment variable
  (`PORTAL_MODE`)

## Why two deployments, not one

Hostinger's hPanel Node.js app manager (built on Phusion Passenger) binds
**one running application to one domain/subdomain** — there's no reverse-proxy
config exposed to you on Cloud/Business hosting the way there would be on a
VPS with your own Nginx. So instead of one process serving two hostnames,
you run the identical app twice, and a small check in `proxy.ts`
(already added) makes each instance refuse the other portal's routes —
visiting `/portal/*` on the admin deployment (or `/admin/*` on the customer
one) redirects the browser to the correct subdomain instead of rendering.
Both instances read/write the same MongoDB Atlas database, so it's one
system from the data's point of view, just two front doors.

This also means: redeploying an update means repeating the deploy steps on
**both** applications (§6 covers this once you've done the initial setup).

---

## 1. Prerequisites

- [ ] Domain's DNS is managed through Hostinger (or you can add DNS records
      wherever it's actually hosted)
- [ ] Hostinger hPanel access for the hosting plan
- [ ] SSH access enabled for the plan (Business/Cloud hosting includes this —
      hPanel → Advanced → SSH Access)
- [ ] A MongoDB Atlas account (free tier is enough to start)

## 2. Set up MongoDB Atlas

1. Create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. **Database Access** → add a database user with a strong password (not
   your Atlas account password — a separate DB user/pass pair).
3. **Network Access** → add an IP allowlist entry. Since Hostinger hPanel
   apps generally don't have a fixed outbound IP you can pin down in
   advance, start with `0.0.0.0/0` (allow from anywhere) to get moving —
   Atlas still requires the correct username/password/TLS to connect, so
   this isn't the same as leaving the database open. Tighten later if
   Hostinger gives you a stable egress IP for the plan.
4. **Connect** → "Drivers" → copy the connection string. It looks like:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/hybrid-networks?retryWrites=true&w=majority
   ```
   Keep the database name (`hybrid-networks` above) — put your real one in.
5. From your own machine, sanity-check it connects before touching
   Hostinger at all:
   ```bash
   MONGODB_URI="mongodb+srv://..." node -e "require('dotenv').config(); const m=require('mongoose'); m.connect(process.env.MONGODB_URI).then(()=>{console.log('connected'); process.exit(0)}).catch(e=>{console.error(e); process.exit(1)})"
   ```

## 3. Point the subdomains at Hostinger

In hPanel → **Domains** (or **DNS Zone Editor** if the domain isn't
Hostinger-registered but you're using Hostinger to host it):

1. Add subdomain `admin` → creates `admin.yourdomain.com`
2. Add subdomain `customer` → creates `customer.yourdomain.com`

Hostinger usually auto-creates the DNS `A`/`CNAME` records when you add a
subdomain through the **Subdomains** screen (rather than the raw DNS Zone
Editor) and points it at your hosting automatically. If you added it
through raw DNS instead, point both at the same server:
- `A` record, host `admin`, value = your hosting's IP address
- `A` record, host `customer`, value = same IP address

DNS propagation can take a few minutes to a few hours.

## 4. Get the code onto the server

SSH in (hPanel → Advanced → SSH Access gives you the host/port/username):

```bash
ssh u123456789@yourserver.hostinger.com -p 65002
```

Clone (or `scp`/upload if this repo isn't in git yet) the code into **two**
separate directories — each hPanel Node.js application needs its own
Application Root:

```bash
git clone <your-repo-url> ~/domains/admin.yourdomain.com/hybrid-admin
git clone <your-repo-url> ~/domains/customer.yourdomain.com/hybrid-customer
```

(Exact base path depends on how Hostinger lays out your account — hPanel's
Node.js app creation screen shows you the Application Root it expects once
you create the app in §5, so it's fine to `git clone` there once you see it.)

**Don't** copy a `node_modules` folder from your Mac/Windows machine — some
packages compile native code per-OS. Always run `npm install` on the server
itself (done per-app in §5).

## 5. Create the two Node.js applications in hPanel

hPanel → **Advanced** → **Node.js** (label may read slightly differently
depending on your panel version) → **Create Application**.

**Admin application:**
| Field | Value |
|---|---|
| Node.js version | 20.x or latest LTS available |
| Application mode | Production |
| Application root | `domains/admin.yourdomain.com/hybrid-admin` (the folder from §4) |
| Application URL | `admin.yourdomain.com` |
| Application startup file | `server.js` |

**Customer application:** same, but root = the `hybrid-customer` folder and
Application URL = `customer.yourdomain.com`.

After creating each app, hPanel shows an **environment variables** section
(sometimes as a `.env` upload, sometimes as key/value fields) and an
**"Run NPM Install"** button. Add these for the **admin** app:

```
MONGODB_URI=<your Atlas connection string>
JWT_SECRET=<a long random string — same value on both apps>
NEXT_PUBLIC_APP_URL=https://admin.yourdomain.com
PORTAL_MODE=admin
ADMIN_PORTAL_URL=https://admin.yourdomain.com
CUSTOMER_PORTAL_URL=https://customer.yourdomain.com
NODE_ENV=production
SLASH_API_KEY=<the real SLASH API key>
SMTP_HOST=... SMTP_PORT=... SMTP_USER=... SMTP_PASS=... EMAIL_FROM=...
```

And for the **customer** app — identical except:
```
NEXT_PUBLIC_APP_URL=https://customer.yourdomain.com
PORTAL_MODE=customer
```

`JWT_SECRET` **must be the exact same value on both** — it's what makes a
session token verifiable; it does not need to be the same cookie (each
subdomain gets its own cookie automatically, browsers never share cookies
across subdomains here). Generate one with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Don't set `PORT` yourself — hPanel assigns it and injects it into the
app's environment; `server.js` already reads `process.env.PORT`.

## 6. Build and start each app

SSH into each application's shell (hPanel gives you a per-app "Enter
virtual environment" shortcut, or `cd` there manually with the Node
version hPanel selected loaded — hPanel's app page shows the exact command):

```bash
cd ~/domains/admin.yourdomain.com/hybrid-admin
npm install
npm run build
```

Repeat for the customer app's directory. Then, back in hPanel's Node.js
app screen for each app, click **Restart**. Hostinger's Node.js app runner
(Passenger) is what actually executes `server.js` after that — you don't
run `node server.js` yourself.

If a build step needs an env var that's only set in hPanel's Node.js panel
(not your shell), export it manually before building, e.g.:
```bash
export MONGODB_URI="mongodb+srv://..."
npm run build
```
(This build doesn't actually hit the database at build time — Next.js only
needs `MONGODB_URI` at request time — but harmless to have it set.)

## 7. SSL

hPanel → **Security** → **SSL** → issue a free Let's Encrypt certificate for
each subdomain individually (`admin.yourdomain.com` and
`customer.yourdomain.com`) — they're separate hostnames and need their own
certificates (or one certificate covering both as SANs, if hPanel offers
that option). Enable "Force HTTPS" for both once issued.

This matters beyond just the padlock icon: the session cookie is set with
`secure: true` in production (`lib/auth/session.ts`), so **login will
silently fail over plain HTTP** in production — SSL isn't optional here.

## 8. Verify

- [ ] `https://admin.yourdomain.com` redirects to `/login`, and a super
      admin can log in and land on the admin dashboard
- [ ] `https://customer.yourdomain.com` redirects to `/login`, and a
      customer can log in and land on their overview
- [ ] Visiting `https://admin.yourdomain.com/portal/devices` while logged
      out redirects to `https://customer.yourdomain.com/portal/devices`
- [ ] Visiting `https://customer.yourdomain.com/admin` redirects to
      `https://admin.yourdomain.com/admin`
- [ ] A customer logging in on the admin subdomain by mistake ends up back
      on the customer subdomain, not stuck
- [ ] `/api/admin/reports/export?...` and `/api/portal/reports/export?...`
      both download real files

## 9. Deploying an update later

Per application (repeat for both):
```bash
cd ~/domains/<subdomain>/hybrid-<admin|customer>
git pull
npm install    # only needed if package.json changed
npm run build
```
Then **Restart** that app in hPanel's Node.js screen.

## 10. Common issues

- **"Application failed to start"** in hPanel — check the app's log viewer
  (same Node.js screen usually has a "Logs" or "Errors" tab). Most common
  cause: a missing required env var (`MONGODB_URI` or `JWT_SECRET`), or
  `npm run build` was never run so `.next/` doesn't exist yet.
- **Login redirects loop or fails silently** — almost always the SSL/
  `secure` cookie issue from §7, or `JWT_SECRET` differing between the two
  apps after a manual edit.
- **Images look soft / a build warning mentions `sharp`** — optional, but
  `npm install sharp` on each app improves `next/image` output quality in
  a self-hosted (non-Vercel) deployment. Not required to function.
- **One app's changes don't show up** — you built/restarted the wrong
  app's directory. Each subdomain is a fully separate `git clone` /
  `node_modules` / `.next` — there's no shared state between them except
  the database.
