import mongoose from "mongoose";
import AccountModel from "../model/account.model";
import ResidentCensusModel from "../model/residentCensus.model";
import {
  buildDuplicateReport,
  matchPerson,
  type DuplicateReportEntry,
} from "../utils/duplicateCheck";

// ── Brute-force reference ────────────────────────────────────────────
// The ORIGINAL O(n²) all-pairs implementation, kept only in the test as an
// oracle: buildDuplicateReport() must return exactly the same entries, in
// the same order, as this reference.
function refOf(
  kind: "account" | "census",
  r: any,
): {
  kind: string;
  id: string;
  name: any;
  dob: any;
  gender: any;
  contact: any;
  censusId?: any;
  accountId?: any;
} {
  return {
    kind,
    id: String(r._id),
    name: r.name,
    dob: kind === "account" ? r.dateOfBirth : r.birthday,
    gender: kind === "account" ? r.gender : r.sex,
    contact: kind === "account" ? r.contact : r.cellphone,
    censusId: kind === "account" ? r.censusId : undefined,
    accountId: kind === "census" ? r.accountId : undefined,
  };
}

function bruteForce(accounts: any[], census: any[]): DuplicateReportEntry[] {
  const acctRefs = accounts.map((a) => refOf("account", a));
  const censusRefs = census.map((r) => refOf("census", r));
  const entries: DuplicateReportEntry[] = [];
  const add = (a: any, b: any) => {
    // Mirror the linked-pair exclusion: an account and the census record it
    // is linked to are the same person by design, not a duplicate.
    if (a.kind !== b.kind) {
      const account = a.kind === "account" ? a : b;
      const cen = a.kind === "account" ? b : a;
      if (
        (account.censusId && String(account.censusId) === cen.id) ||
        (cen.accountId && String(cen.accountId) === account.id)
      ) {
        return;
      }
    }
    const level = matchPerson(
      { name: a.name, dob: a.dob, gender: a.gender, contact: a.contact },
      { name: b.name, dob: b.dob, gender: b.gender, contact: b.contact },
    );
    if (level !== "clean") entries.push({ a, b, level, reason: "" } as any);
  };
  for (let i = 0; i < acctRefs.length; i++)
    for (let j = i + 1; j < acctRefs.length; j++) add(acctRefs[i], acctRefs[j]);
  for (const a of acctRefs) for (const bc of censusRefs) add(a, bc);
  for (let i = 0; i < censusRefs.length; i++)
    for (let j = i + 1; j < censusRefs.length; j++)
      add(censusRefs[i], censusRefs[j]);
  return entries;
}

const keyOf = (e: DuplicateReportEntry) =>
  `${e.a.kind}:${e.a.id}|${e.b.kind}:${e.b.id}|${e.level}`;

async function seed(accounts: any[], census: any[]) {
  if (accounts.length)
    await AccountModel.collection.insertMany(
      accounts.map((a, i) => ({
        _id: a._id ?? new mongoose.Types.ObjectId(),
        name: a.name,
        dateOfBirth: a.dateOfBirth ?? "",
        gender: a.gender ?? "",
        contact: a.contact ?? "",
        censusId: a.censusId,
        email: a.email ?? `user${i}-${new mongoose.Types.ObjectId()}@test.local`,
        password: "x",
        status: "active",
        role: "resident",
      })),
    );
  if (census.length)
    await ResidentCensusModel.collection.insertMany(
      census.map((r) => ({
        _id: r._id ?? new mongoose.Types.ObjectId(),
        name: r.name,
        sex: r.sex ?? "N/A",
        birthday: r.birthday ?? "N/A",
        cellphone: r.cellphone ?? "N/A",
        accountId: r.accountId,
      })),
    );
}

async function compareWithReference() {
  const accounts = await AccountModel.find({}).lean();
  const census = await ResidentCensusModel.find({}).lean();
  const expected = bruteForce(accounts, census);
  const actual = await buildDuplicateReport();
  expect(actual.map(keyOf)).toEqual(expected.map(keyOf));
  return { expected, actual };
}

// Deterministic PRNG so failures are reproducible.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: () => number, arr: T[]) =>
  arr[Math.floor(rng() * arr.length)];

describe("duplicateCheck.matchPerson", () => {
  it("treats same name + same DOB as a confident match", () => {
    expect(
      matchPerson(
        { name: "Juan Dela Cruz", dob: "1990-01-10" },
        { name: "Dela Cruz, Juan", dob: "January 10, 1990" },
      ),
    ).toBe("confident");
  });

  it("treats same name + known different DOB as different people", () => {
    expect(
      matchPerson(
        { name: "Maria Santos", dob: "1985-01-05" },
        { name: "Maria Santos", dob: "1985-05-01" },
      ),
    ).toBe("clean");
  });

  it("matches by identical contact + DOB even when names differ", () => {
    expect(
      matchPerson(
        { name: "J. Cruz", dob: "1990-01-10", contact: "09171234567" },
        { name: "Juan Cruz", dob: "1990-01-10", contact: "639171234567" },
      ),
    ).toBe("confident");
  });

  it("returns likely for a name match with missing DOB on one side", () => {
    expect(
      matchPerson(
        { name: "Pedro Reyes", dob: "1990-02-02" },
        { name: "Pedro Reyes", dob: "" },
      ),
    ).toBe("likely");
  });
});

describe("buildDuplicateReport (blocked scan)", () => {
  it("covers every matching branch and equals the all-pairs reference", async () => {
    const accounts = [
      { name: "Juan Dela Cruz", dateOfBirth: "1990-01-10", gender: "Male", contact: "09171234567" },
      { name: "Juan Dela Cruz", dateOfBirth: "1990-01-10", gender: "Male", contact: "09171234567" },
      { name: "Maria Santos", dateOfBirth: "January 5, 1985", gender: "Female", contact: "09180000000" },
      { name: "Maria Santos", dateOfBirth: "1985-05-01", gender: "Female", contact: "" },
      { name: "Pedro Reyes", dateOfBirth: "", gender: "Male", contact: "" },
      { name: "Pedro Reyes", dateOfBirth: "", gender: "Male", contact: "" },
    ];
    const census = [
      { name: "Dela Cruz, Juan", birthday: "1/10/1990", sex: "M", cellphone: "639171234567" },
      { name: "Santos, Maria", birthday: "1985-01-05", sex: "Female", cellphone: "" },
      { name: "Reyes, Pedro", birthday: "N/A", sex: "Male", cellphone: "" },
      { name: "Dela Cruz, Juan", birthday: "1990-01-10", sex: "Male", cellphone: "" },
      { name: "J. Cruz", birthday: "1990-01-10", sex: "Male", cellphone: "09171234567" },
      { name: "Ana Dela Cruz", birthday: "1990-01-10", sex: "Male", cellphone: "" },
      { name: "Juan Bautista", birthday: "1990-01-10", sex: "Male", cellphone: "" },
    ];
    await seed(accounts, census);
    const { actual } = await compareWithReference();
    expect(actual.length).toBeGreaterThan(0);
  });

  it("equals the reference across randomized datasets", async () => {
    const names = [
      "Juan Dela Cruz",
      "Maria Santos",
      "Pedro Reyes",
      "Ana Dela Cruz",
      "Juan Bautista",
      "Dela Cruz, Juan",
      "Santos, Maria",
      "Reyes, Pedro",
    ];
    const dobs = ["", "1990-01-10", "January 5, 1985", "1985-05-01", "N/A", "3/3/2000"];
    const genders = ["Male", "Female", "M", "F", ""];
    const contacts = ["09171234567", "09180000000", "639171234567", "", "09171112222"];

    for (let round = 0; round < 8; round++) {
      const rng = mulberry32(1000 + round);
      const accounts = Array.from({ length: 14 }, () => ({
        name: pick(rng, names),
        dateOfBirth: pick(rng, dobs),
        gender: pick(rng, genders),
        contact: pick(rng, contacts),
      }));
      const census = Array.from({ length: 12 }, () => ({
        name: pick(rng, names),
        birthday: pick(rng, dobs),
        sex: pick(rng, genders),
        cellphone: pick(rng, contacts),
      }));

      // afterEach wipes collections between tests, not between rounds.
      await AccountModel.deleteMany({});
      await ResidentCensusModel.deleteMany({});
      await seed(accounts, census);
      await compareWithReference();
    }
  });

  it("returns an empty report when nothing matches", async () => {
    await seed(
      [{ name: "Alpha One", dateOfBirth: "1970-01-01", gender: "Male", contact: "" }],
      [{ name: "Beta Two", birthday: "1971-02-02", sex: "Female", cellphone: "" }],
    );
    expect(await buildDuplicateReport()).toEqual([]);
  });

  it("does not flag an account against its own linked census record", async () => {
    const accountId = new mongoose.Types.ObjectId();
    const censusId = new mongoose.Types.ObjectId();
    // Same person, cross-linked the way upsertFromAccount() links them.
    await seed(
      [
        {
          _id: accountId,
          name: "Juan Dela Cruz",
          dateOfBirth: "1990-01-10",
          gender: "Male",
          contact: "09171234567",
          censusId,
        },
      ],
      [
        {
          _id: censusId,
          name: "Dela Cruz, Juan",
          birthday: "1990-01-10",
          sex: "Male",
          cellphone: "09171234567",
          accountId,
        },
      ],
    );
    expect(await buildDuplicateReport()).toEqual([]);
  });

  it("still flags a different, unlinked account colliding with a census person", async () => {
    const censusId = new mongoose.Types.ObjectId();
    const linkedAccountId = new mongoose.Types.ObjectId();
    const dupAccountId = new mongoose.Types.ObjectId();
    const census = [
      {
        _id: censusId,
        name: "Dela Cruz, Juan",
        birthday: "1990-01-10",
        sex: "Male",
        cellphone: "09171234567",
        accountId: linkedAccountId,
      },
    ];
    const accounts = [
      // The legitimate, linked account for this census person.
      {
        _id: linkedAccountId,
        name: "Juan Dela Cruz",
        dateOfBirth: "1990-01-10",
        gender: "Male",
        contact: "09171234567",
        censusId,
      },
      // A second account for the SAME person, not linked → a real duplicate.
      {
        _id: dupAccountId,
        name: "Juan Dela Cruz",
        dateOfBirth: "1990-01-10",
        gender: "Male",
        contact: "09171234567",
      },
    ];
    await seed(accounts, census);
    const { actual } = await compareWithReference();
    const hasDup = actual.some(
      (e) =>
        e.a.kind === "account" &&
        e.a.id === String(dupAccountId) &&
        e.b.kind === "census" &&
        e.b.id === String(censusId) &&
        e.level === "confident",
    );
    expect(hasDup).toBe(true);
  });

  it("stays sub-quadratic on a large census (performance guard)", async () => {
    const rng = mulberry32(42);
    const first = ["Juan", "Maria", "Pedro", "Ana", "Jose", "Rosa", "Mark", "Liza"];
    const last = ["Cruz", "Santos", "Reyes", "Bautista", "Garcia", "Lopez"];
    const census = Array.from({ length: 2000 }, (_, i) => ({
      name: `${pick(rng, first)} ${pick(rng, last)} ${i}`,
      birthday: "1990-01-10",
      sex: "Male",
      cellphone: "",
    }));
    await seed([], census);

    const started = Date.now();
    await buildDuplicateReport();
    const elapsed = Date.now() - started;
    // Old all-pairs scan ~ (2000²/2) × 9µs ≈ 18s. Blocked scan is well under.
    expect(elapsed).toBeLessThan(8000);
  }, 30000);
});
