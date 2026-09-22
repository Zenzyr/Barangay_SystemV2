import ResidentCensusModel from "../model/residentCensus.model";
import AccountModel from "../model/account.model";
import DocumentModel from "../model/documentRequest.model";
import { safeRate } from "../utils/analyticsRules";

// ─── Age helpers ────────────────────────────────────────────────
function getAge(record: { age: any; birthday: string }): number | null {
  if (typeof record.age === "number" && !isNaN(record.age)) return record.age;
  if (typeof record.age === "string" && /^\d+$/.test(record.age.trim())) return parseInt(record.age, 10);

  if (record.birthday && record.birthday !== "N/A") {
    const parsed = new Date(record.birthday);
    if (!isNaN(parsed.getTime())) {
      const diffMs = Date.now() - parsed.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
    }
  }
  return null;
}

function isFilled(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.trim().toUpperCase();
  return v !== "" && v !== "N/A" && v !== "NONE";
}

const UNEMPLOYED_OCCUPATION_VALUES = ["UNEMPLOYED", "NONE", "N/A", "JOBLESS", "NO OCCUPATION"];

function isEmployedHeuristic(occupation: string): boolean {
  if (!isFilled(occupation)) return false;
  return !UNEMPLOYED_OCCUPATION_VALUES.includes(occupation.trim().toUpperCase());
}

export class CommunityAnalyticsService {

  // ── Population Overview ─────────────────────────────────────────
  static async getOverview() {
    const residents = await ResidentCensusModel.find({ isArchived: { $ne: true } });
    const households = new Set(residents.map((r) => r.householdNumber));

    let children = 0, youth = 0, workingAge = 0, seniors = 0, pwd = 0;
    for (const r of residents) {
      const age = getAge(r);
      if (age !== null) {
        if (age < 15) children++;
        if (age >= 15 && age <= 30) youth++;
        if (age >= 15 && age <= 64) workingAge++;
      }
      if (r.isSenior === "YES") seniors++;
      if (r.isPWD === "YES") pwd++;
    }

    const unemployedHeuristic = residents.filter((r) => {
      const age = getAge(r);
      return age !== null && age >= 15 && age <= 64 && !isEmployedHeuristic(r.occupation);
    }).length;

    return {
      totalResidents: residents.length,
      totalHouseholds: households.size,
      children,
      youth,
      workingAgePopulation: workingAge,
      seniorCitizens: seniors,
      pwd,
      unemployedHeuristic,
      dataSource: "ResidentCensus",
      note: "Figures are drawn from the resident census. 'Unemployed' is a heuristic based on blank/none occupation entries, not a verified employment status field.",
    };
  }

  // ── Employment ───────────────────────────────────────────────────
  static async getEmploymentSector() {
    const residents = await ResidentCensusModel.find({ isArchived: { $ne: true } });
    const workingAge = residents.filter((r) => {
      const age = getAge(r);
      return age !== null && age >= 15 && age <= 64;
    });

    const unemployed = workingAge.filter((r) => !isEmployedHeuristic(r.occupation));
    const rate = safeRate(unemployed.length, workingAge.length);

    const occCounts: Record<string, number> = {};
    for (const r of residents) {
      if (isEmployedHeuristic(r.occupation)) {
        const key = r.occupation.trim();
        occCounts[key] = (occCounts[key] || 0) + 1;
      }
    }
    const topOccupations = Object.entries(occCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      available: true,
      workingAgePopulation: workingAge.length,
      unemployedHeuristic: unemployed.length,
      unemploymentRateHeuristic: rate,
      topOccupations,
      dataSource: "ResidentCensus.occupation",
      note: "Unemployment is a heuristic derived from blank/'none'/'unemployed' occupation entries. There is no structured employment-status field in the current data, so this is an estimate, not a verified rate.",
    };
  }

  // ── Education ──────────────────────────────────────────────────
  static async getEducationSector() {
    const residents = await ResidentCensusModel.find({ isArchived: { $ne: true } });
    const schoolAge = residents.filter((r) => {
      const age = getAge(r);
      return age !== null && age >= 5 && age <= 17;
    });
    const outOfSchool = schoolAge.filter((r) => !isFilled(r.education));
    const rate = safeRate(outOfSchool.length, schoolAge.length);

    const eduCounts: Record<string, number> = {};
    for (const r of residents) {
      if (isFilled(r.education)) {
        const key = r.education.trim();
        eduCounts[key] = (eduCounts[key] || 0) + 1;
      }
    }
    const attainmentDistribution = Object.entries(eduCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      available: true,
      schoolAgePopulation: schoolAge.length,
      outOfSchoolHeuristic: outOfSchool.length,
      outOfSchoolRateHeuristic: rate,
      attainmentDistribution,
      dataSource: "ResidentCensus.education",
      note: "Out-of-school rate is a heuristic based on school-age residents (5-17) with no recorded education level, not a verified enrollment status.",
    };
  }

  // ── Senior Citizens ────────────────────────────────────────────
  static async getSeniorSector() {
    const residents = await ResidentCensusModel.find({ isArchived: { $ne: true } });
    const seniors = residents.filter((r) => r.isSenior === "YES");
    const pensioners = residents.filter((r) => isFilled(r.pensioner));
    const rate = safeRate(seniors.length, residents.length);

    return {
      available: true,
      totalResidents: residents.length,
      seniorCitizens: seniors.length,
      seniorCitizenRate: rate,
      pensioners: pensioners.length,
      dataSource: "ResidentCensus.isSenior / pensioner",
    };
  }

  // ── PWD ────────────────────────────────────────────────────────
  static async getPwdSector() {
    const residents = await ResidentCensusModel.find({ isArchived: { $ne: true } });
    const pwd = residents.filter((r) => r.isPWD === "YES");
    const rate = safeRate(pwd.length, residents.length);

    const byPurok: Record<string, number> = {};
    for (const r of pwd) {
      byPurok[r.purok] = (byPurok[r.purok] || 0) + 1;
    }

    return {
      available: true,
      totalResidents: residents.length,
      pwd: pwd.length,
      pwdRate: rate,
      byPurok: Object.entries(byPurok).map(([purok, count]) => ({ purok, count })),
      dataSource: "ResidentCensus.isPWD",
    };
  }

  // ── Youth ──────────────────────────────────────────────────────
  static async getYouthSector() {
    const residents = await ResidentCensusModel.find({ isArchived: { $ne: true } });
    const youth = residents.filter((r) => {
      const age = getAge(r);
      return age !== null && age >= 15 && age <= 30;
    });
    const rate = safeRate(youth.length, residents.length);
    const employedYouth = youth.filter((r) => isEmployedHeuristic(r.occupation));

    return {
      available: true,
      totalResidents: residents.length,
      youthPopulation: youth.length,
      youthRate: rate,
      employedYouthHeuristic: employedYouth.length,
      dataSource: "ResidentCensus (age 15-30)",
      note: "Youth is defined here as ages 15-30 (RA 8044). Employment figure uses the same occupation heuristic as the Employment sector.",
    };
  }

  // ── Social / Household Welfare ────────────────────────────────
  static async getSocialWelfareSector() {
    const residents = await ResidentCensusModel.find({ isArchived: { $ne: true } });
    const households = new Set(residents.map((r) => r.householdNumber));
    const fourPs = residents.filter((r) => r.is4Ps === "YES");
    const soloParents = residents.filter((r) => r.soloParent === "YES");
    const familyPlanning = residents.filter((r) => isFilled(r.familyPlanning));

    return {
      available: true,
      totalResidents: residents.length,
      totalHouseholds: households.size,
      avgHouseholdSize: households.size ? Math.round((residents.length / households.size) * 100) / 100 : 0,
      fourPsBeneficiaries: fourPs.length,
      fourPsRate: safeRate(fourPs.length, residents.length),
      soloParents: soloParents.length,
      soloParentRate: safeRate(soloParents.length, residents.length),
      familyPlanningUsers: familyPlanning.length,
      familyPlanningRate: safeRate(familyPlanning.length, residents.length),
      dataSource: "ResidentCensus.is4Ps / soloParent / familyPlanning",
    };
  }

  // ── Health (partial data only) ────────────────────────────────
  static async getHealthSector() {
    const residents = await ResidentCensusModel.find({ isArchived: { $ne: true } });
    const hpnMaintenance = residents.filter((r) => r.hpnMaintenance === "YES");
    const familyPlanning = residents.filter((r) => isFilled(r.familyPlanning));

    return {
      available: true,
      partial: true,
      totalResidents: residents.length,
      hpnMaintenance: hpnMaintenance.length,
      hpnMaintenanceRate: safeRate(hpnMaintenance.length, residents.length),
      familyPlanningUsers: familyPlanning.length,
      familyPlanningRate: safeRate(familyPlanning.length, residents.length),
      dataSource: "ResidentCensus.hpnMaintenance / familyPlanning",
      note: "This is partial health data. There is no nutritional-status, weight/height, or general health-condition record in the current system, so indicators like malnutrition rate cannot be calculated. HPN Maintenance (hypertension/diabetes medication upkeep) is shown as the closest available chronic-health proxy.",
    };
  }

  // ── Sectors with no data source (must not be fabricated) ──────
  static getUnavailableSector(sectorName: string) {
    return {
      available: false,
      sector: sectorName,
      message: `No data source exists in the current system for ${sectorName}. Add a data collection feature (e.g. a household vulnerability form, incident/blotter log, or environmental complaint log) before analytics can be produced for this sector.`,
    };
  }

  // ── Purok Analysis ──────────────────────────────────────────────
  static async getPurokAnalysis() {
    const residents = await ResidentCensusModel.find({ isArchived: { $ne: true } });
    const puroks = Array.from(new Set(residents.map((r) => r.purok))).sort();

    return puroks.map((purok) => {
      const group = residents.filter((r) => r.purok === purok);
      const workingAge = group.filter((r) => {
        const age = getAge(r);
        return age !== null && age >= 15 && age <= 64;
      });
      const unemployed = workingAge.filter((r) => !isEmployedHeuristic(r.occupation));
      const schoolAge = group.filter((r) => {
        const age = getAge(r);
        return age !== null && age >= 5 && age <= 17;
      });
      const outOfSchool = schoolAge.filter((r) => !isFilled(r.education));

      return {
        purok,
        population: group.length,
        households: new Set(group.map((r) => r.householdNumber)).size,
        seniorCitizens: group.filter((r) => r.isSenior === "YES").length,
        seniorCitizenRate: safeRate(group.filter((r) => r.isSenior === "YES").length, group.length),
        pwd: group.filter((r) => r.isPWD === "YES").length,
        pwdRate: safeRate(group.filter((r) => r.isPWD === "YES").length, group.length),
        fourPs: group.filter((r) => r.is4Ps === "YES").length,
        fourPsRate: safeRate(group.filter((r) => r.is4Ps === "YES").length, group.length),
        soloParents: group.filter((r) => r.soloParent === "YES").length,
        soloParentRate: safeRate(group.filter((r) => r.soloParent === "YES").length, group.length),
        unemploymentRateHeuristic: safeRate(unemployed.length, workingAge.length),
        outOfSchoolRateHeuristic: safeRate(outOfSchool.length, schoolAge.length),
      };
    });
  }

  // ── Service Request Signals (registered login residents, Documents) ──
  static async getServiceRequestSignals() {
    const accounts = await AccountModel.find();
    const documents = await DocumentModel.find();

    const indigencyRequests = documents.filter((d) => d.document === "certificateOfIndigency");

    return {
      available: true,
      totalRegisteredResidents: accounts.length,
      indigencyRequests: indigencyRequests.length,
      indigencyRequestRate: safeRate(indigencyRequests.length, accounts.length),
      dataSource: "Documents (self-requested certificates) + Accounts",
      note: "This uses a different population (registered login residents, N=" + accounts.length + ") than the census-based sectors above. Counts reflect residents who requested these certificates themselves and are a self-reported signal, not a full survey.",
    };
  }

  // ── Historical Trends ───────────────────────────────────────────
  static async getHistoricalTrends() {
    return {
      available: false,
      message: "Insufficient historical data. Only a single resident census snapshot currently exists (no dated periodic assessments), so trend analysis cannot be produced yet. This will become available once multiple dated census imports or assessments exist.",
    };
  }

  // ── Flattened indicator map for the recommendation engine ─────
  static async getIndicatorMap(): Promise<{ values: Record<string, number>; affected: Record<string, number> }> {
    const [employment, education, seniors, pwd, youth, social, health] = await Promise.all([
      this.getEmploymentSector(),
      this.getEducationSector(),
      this.getSeniorSector(),
      this.getPwdSector(),
      this.getYouthSector(),
      this.getSocialWelfareSector(),
      this.getHealthSector(),
    ]);

    return {
      values: {
        unemploymentRateHeuristic: employment.unemploymentRateHeuristic,
        outOfSchoolRateHeuristic: education.outOfSchoolRateHeuristic,
        seniorCitizenRate: seniors.seniorCitizenRate,
        pwdRate: pwd.pwdRate,
        youthRate: youth.youthRate,
        fourPsRate: social.fourPsRate,
        soloParentRate: social.soloParentRate,
        hpnMaintenanceRate: health.hpnMaintenanceRate,
        familyPlanningRate: social.familyPlanningRate,
      },
      affected: {
        unemploymentRateHeuristic: employment.unemployedHeuristic,
        outOfSchoolRateHeuristic: education.outOfSchoolHeuristic,
        seniorCitizenRate: seniors.seniorCitizens,
        pwdRate: pwd.pwd,
        youthRate: youth.youthPopulation,
        fourPsRate: social.fourPsBeneficiaries,
        soloParentRate: social.soloParents,
        hpnMaintenanceRate: health.hpnMaintenance,
        familyPlanningRate: social.familyPlanningUsers,
      },
    };
  }
}
