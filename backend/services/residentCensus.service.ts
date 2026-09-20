import ResidentCensusModel from "../model/residentCensus.model";
import AccountModel from "../model/account.model";
import { residentCensusInterfaceInput } from "../types/residentCensus.type";
import { matchPerson } from "../utils/duplicateCheck";
import { calculateAge } from "../utils/age";

// Values used to signal "not applicable / unknown" on legacy census records.
const NVA = ["", "n/a", "na", "none", "null", "-", "undeclared", "not applicable"];

function clean(value: unknown): string {
  const raw = String(value == null ? "" : value).trim();
  if (NVA.includes(raw.toLowerCase())) return "N/A";
  return raw;
}

export class ResidentCensusService {

  static async create(data: residentCensusInterfaceInput) {
    return await ResidentCensusModel.create(data);
  }

  /**
   * Identity-based lookup used by duplicate protection. Candidates are found
   * by a loose token match on the name (so "Orlando Munar" and
   * "Munar,Orlando Munar" compare equal); callers then use matchPerson to
   * decide whether a candidate is actually the same person.
   */
  static async findByName(name: string, idToExclude?: string) {
    const raw = String(name || "").trim();
    const tokens = raw
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter((t) => t.length >= 3);
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const q: Record<string, any> = {};
    if (tokens.length) {
      q.name = { $regex: tokens.map(escape).join("|"), $options: "i" };
    } else if (raw) {
      q.name = { $regex: `^${escape(raw)}$`, $options: "i" };
    } else {
      return [];
    }
    if (idToExclude) q._id = { $ne: idToExclude };
    return await ResidentCensusModel.find(q).limit(50).lean();
  }

  /**
   * Auto-sync an approved/registered resident account into the census
   * collection. Idempotent: when an existing census record confidently or
   * likely matches the person's identity (name + birthday / phone), the sync
   * is skipped so approvals and sign-ups never duplicate a census entry.
   *
   * As a bonus both records are cross-linked (account.censusId ⇄
   * census.accountId) so edits on either side stay in sync.
   */
  static async upsertFromAccount(account: any) {
    const { name, gender, dateOfBirth, contact, purok, houseHoldNumber, _id } = account || {};
    if (!name) return { census: null, created: false };

    const candidates = await this.findByName(name);
    const match = candidates.find((c) => {
      const level = matchPerson(
        { name, dob: dateOfBirth, gender, contact },
        { name: c.name, dob: c.birthday, gender: c.sex, contact: c.cellphone }
      );
      return level === "confident" || level === "likely";
    });

    let census;
    let created = false;
    if (match) {
      census = await ResidentCensusModel.findByIdAndUpdate(match._id, {
        accountId: _id || undefined,
        ...(dateOfBirth ? { age: calculateAge(dateOfBirth) } : {}),
      }, { new: true }).lean();
      census = census || match;
    } else {
      census = await ResidentCensusModel.create({
        name: name || "N/A",
        sex: gender || "N/A",
        birthday: dateOfBirth || "N/A",
        age: dateOfBirth ? calculateAge(dateOfBirth) : "N/A",
        occupation: "N/A",
        education: "N/A",
        purok: purok || "N/A",
        householdNumber: houseHoldNumber || "N/A",
        is4Ps: "N/A",
        soloParent: "N/A",
        familyPlanning: "N/A",
        isSenior: "N/A",
        hpnMaintenance: "N/A",
        pensioner: "N/A",
        isPWD: "N/A",
        cellphone: contact || "N/A",
        accountId: _id || undefined,
      });
      created = true;
    }

    // Point the account back at its census record (idempotent).
    if (census && _id) {
      await AccountModel.updateOne({ _id }, { censusId: census._id }).catch(() => {});
    }

    return { census, created };
  }

  /** Link a census record and an account to each other (both directions). */
  static async linkToAccount(censusId: string, accountId: string) {
    await ResidentCensusModel.updateOne({ _id: censusId }, { accountId });
    await AccountModel.updateOne({ _id: accountId }, { censusId });
  }

  /** Find the census record linked to a given account. */
  static async getByAccountId(accountId: string) {
    return await ResidentCensusModel.findOne({ accountId });
  }

  /**
   * Sync a census record's identities fields onto its linked account, if any.
   * Used when the secretary edits the census so the online profile stays fresh.
   */
  static async syncLinkedAccount(censusId: string) {
    const census = await ResidentCensusModel.findById(censusId);
    if (!census || !census.accountId) return null;
    const accountId = String(census.accountId);
    const updates: Record<string, any> = {};
    if (census.name && census.name !== "N/A") {
      updates.name = census.name.includes(",")
        ? census.name.split(",").reverse().join(" ").replace(/\s+/g, " ").trim()
        : census.name;
    }
    if (census.sex && census.sex !== "N/A") updates.gender = census.sex;
    if (census.birthday && census.birthday !== "N/A") updates.dateOfBirth = census.birthday;
    if (census.age && census.age !== "N/A") updates.age = census.age;
    if (census.purok && census.purok !== "N/A") updates.purok = census.purok;
    if (census.householdNumber && census.householdNumber !== "N/A") updates.houseHoldNumber = census.householdNumber;
    if (census.cellphone && census.cellphone !== "N/A") updates.contact = census.cellphone;
    await AccountModel.updateOne({ _id: accountId }, { $set: updates }).catch(() => {});
    return accountId;
  }

  /**
   * Sync a resident account's identity fields back onto its linked census
   * record, if any. Used when a resident updates their profile/account.
   */
  static async syncLinkedCensus(accountId: string) {
    const account = await AccountModel.findById(accountId);
    if (!account || !account.censusId) return null;
    const censusId = String(account.censusId);
    const updates: Record<string, any> = {};
    if (account.name) updates.name = account.name;
    if (account.gender) updates.sex = account.gender;
    if (account.dateOfBirth) {
      updates.birthday = account.dateOfBirth;
      updates.age = calculateAge(account.dateOfBirth);
    }
    if (account.purok) updates.purok = account.purok;
    if (account.houseHoldNumber) updates.houseHoldNumber = account.houseHoldNumber;
    if (account.contact) updates.cellphone = account.contact;
    await ResidentCensusModel.updateOne({ _id: censusId }, { $set: updates }).catch(() => {});
    return censusId;
  }

  /**
   * Bulk-import census records (CSV/JSON upload). Each row is duplicate
   * checked individually so re-importing a file never doubles a resident.
   * Returns a summary of what was inserted and what was skipped.
   */
  static async bulkImport(records: Array<Record<string, any>>) {
    let inserted = 0;
    const skipped: Array<{ name: string; reason: string }> = [];

    for (const raw of records) {
      const name = clean(raw.name);
      if (!name || name === "N/A") {
        skipped.push({ name: String(raw.name ?? "").slice(0, 60) || "(no name)", reason: "Missing name" });
        continue;
      }
      const birthday = clean(raw.birthday ?? raw.birthDate ?? raw.dob);
      const sex = clean(raw.sex ?? raw.gender);
      const cellphone = clean(raw.cellphone ?? raw.contact ?? raw.contactNumber ?? raw.mobile);

      let duplicate = null;
      try {
        const candidates = await this.findByName(name);
        duplicate = candidates.find((c) => {
          const level = matchPerson(
            { name, dob: birthday, gender: sex, contact: cellphone },
            { name: c.name, dob: c.birthday, gender: c.sex, contact: c.cellphone }
          );
          return level === "confident" || level === "likely";
        });
      } catch (err) {
        console.error("[CENSUS-IMPORT LOOKUP ERROR]", err);
      }

      if (duplicate) {
        skipped.push({ name: String(raw.name).slice(0, 60), reason: "Already in census" });
        continue;
      }

      const age = raw.age === undefined || raw.age === null || String(raw.age).trim() === ""
        ? "N/A"
        : isNaN(Number(raw.age))
          ? "N/A"
          : Number(raw.age);

      try {
        await ResidentCensusModel.create({
          name,
          sex,
          birthday,
          age,
          occupation: clean(raw.occupation),
          education: clean(raw.education),
          purok: clean(raw.purok ?? raw.purock ?? "N/A") || "N/A",
          householdNumber: clean(raw.householdNumber ?? raw.household ?? raw.householdNo),
          is4Ps: clean(raw.is4Ps ?? raw.isP4ps ?? raw.fourPs),
          soloParent: clean(raw.soloParent ?? raw.soloParentStatus),
          familyPlanning: clean(raw.familyPlanning ?? raw.familyPlanningMethod),
          isSenior: clean(raw.isSenior ?? raw.senior),
          hpnMaintenance: clean(raw.hpnMaintenance ?? raw.hypertensionMaintenance ?? raw.hppMaintenance),
          pensioner: clean(raw.pensioner),
          isPWD: clean(raw.isPWD ?? raw.pwd),
          cellphone,
        });
        inserted++;
      } catch (err) {
        console.error("[CENSUS-IMPORT CREATE ERROR]", err);
        skipped.push({ name: String(raw.name).slice(0, 60), reason: "Failed to save" });
      }
    }

    return { inserted, skipped };
  }

  static async getAll(filter: Record<string, any> = {}) {
    return await ResidentCensusModel.find(filter).sort({ purok: 1, householdNumber: 1 });
  }

  static async get(id: string) {
    return await ResidentCensusModel.findById(id);
  }

  static async update(id: string, data: Partial<residentCensusInterfaceInput>) {
    return await ResidentCensusModel.findByIdAndUpdate(id, data, { new: true });
  }

  static async delete(id: string) {
    return await ResidentCensusModel.findByIdAndDelete(id);
  }
}
