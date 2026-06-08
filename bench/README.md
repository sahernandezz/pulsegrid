# Running PulseGrid on a dedicated host

The laptop runs everything — the app under test, **Postgres**, and the **k6** load
generator — on the same 8 cores. That co-location is what produced two artefacts:

- the **8-CPU collapse** (pinning the app to all 8 cores starved Postgres + k6), and
- **"DB tuning doesn't help"** (more connections just added CPU contention).

To get clean numbers you don't need a managed database — you need **more cores than
the workload uses, with each component pinned to its own cores**. One throwaway VM
does it. Spin up → run → copy the JSON out → destroy.

## 1. Pick a host

Any Linux VM with Docker. The app envelopes go up to 4 CPU, so leave plenty for the
DB and the load generator:

| host | vCPU | notes |
|---|---|---|
| **AWS** `c7i.4xlarge` | 16 | recommended; same-AZ, on-demand a few $/hr |
| **Hetzner** `CCX33` / `CCX43` | 8 / 16 | cheapest; CCX43 (16) is ideal |
| **DigitalOcean** CPU-Optimized 16 vCPU | 16 | simple |
| minimum | 8 | works, but tight — 16+ strongly preferred |

> Use a **dedicated/compute-optimized** instance, not a burstable one (no CPU credits).

## 2. Provision (once, on a fresh Ubuntu 22.04+ VM)

```bash
REPO=https://github.com/YOUR_USER/pulsegrid.git \
  bash bench/provision.sh          # installs Docker, k6, python; clones the repo
# log out / back in so the docker group applies
```

## 3. Run the whole suite

```bash
cd pulsegrid
bash bench/cloud_run.sh            # ~1.5–2 h (native builds dominate)
```

`cloud_run.sh` auto-computes the core map from `nproc` and pins everything:

```
app       cores 0-3        (set per envelope by the sweep)
postgres  cores 4-9        (PG_DB_CPUSET, with a 128 pool / 300 max_conn)
k6        cores 10-15      (K6_CPUSET, via taskset)
```

It regenerates the three files the frontend reads:

- `consolidated-results.json` — baseline 2 CPU/1g, all variants, http+queue, **environment block**
- `scaling-results.json` — http across 1/2/4 CPU
- `scaling-queue-results.json` — queue across 1/2/4 CPU

and copies them to `frontend/public/`.

For a lower-noise final run: `RUNS=3 bash bench/cloud_run.sh`.

## 4. Take the data and destroy the VM

```bash
# from your machine:
scp user@vm:~/pulsegrid/{consolidated,scaling,scaling-queue}-results.json frontend/public/
npm --prefix frontend run build      # rebuild the showcase with the clean numbers
```

Then **terminate the VM** — you only needed it for the run. Total cost: a few dollars.

## Pinning knobs (set by `cloud_run.sh`, usable standalone)

| env | effect |
|---|---|
| `PG_DB_CPUSET` | pin Postgres/Kafka containers to these cores (`docker update --cpuset-cpus`) |
| `K6_CPUSET` | pin the k6 process to these cores (`taskset -c`, Linux only) |
| `PG_CPUS` / `PG_MEM` / `PG_CPUSET` | app-under-test limits (per envelope) |
| `PG_SYNC` / `PG_POOL` / `PG_MAXCONN` | Postgres `synchronous_commit` / app pool / `max_connections` |

All are **no-ops when unset**, so the laptop workflow is unchanged.

## Note on the numbers

Moving off the laptop **changes the absolute values** (different CPU, clock, memory
bandwidth). Re-run the *whole* suite on the new host so everything is comparable, and
the "Where it ran" panel will reflect it. With clean separation you should finally see
honest CPU scaling (the 8-CPU point stops collapsing) and a meaningful answer to
whether DB tuning helps once the DB has its own cores.
