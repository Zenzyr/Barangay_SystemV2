import AccountModel from "../model/account.model"
import { accountInterface, accountInterfaceInput } from "../types/accounts.type";
import { ROLES } from "../utils/roles";


export class AccountService {

  static async create(data : accountInterfaceInput) {
    return await AccountModel.create(data)
  }

  static async getAll(filter: Record<string, any> = {}) {
    return await AccountModel.find(filter).select('-password');
  }

  static async get(id : string) {
    return await AccountModel.findById(id);
  }

  static async getProfile(id: string) {
    return await AccountModel.findById(id).select('-password');
  }

  static async addSkill(id: string, skill: { skill: string; experience: number; proficiency: string; serviceTypes?: string[] }) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { $push: { skills: skill } },
      { new: true }
    ).select('-password');
  }

  static async removeSkill(id: string, skillId: string) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { $pull: { skills: { _id: skillId } } },
      { new: true }
    ).select('-password');
  }

  static async delete(id : string) {
    return await AccountModel.findByIdAndDelete(id);
  }

  static async update(id : string, data : Partial<accountInterface>) {
    return await AccountModel.findByIdAndUpdate(id, data, { new: true });
  }

  static async updateStatus(id: string, status: string) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
  }

  /** Race-safe status change: only applies when the status is still `fromStatus`. */
  static async updateStatusIf(id: string, fromStatus: string, status: string) {
    return await AccountModel.findOneAndUpdate(
      { _id: id, status: fromStatus },
      { $set: { status } },
      { new: true }
    ).select("-password");
  }

  static async updateRole(id: string, role: string) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    );
  }

  /** Race-safe role change: only applies when the role is still `fromRole`. */
  static async updateRoleIf(id: string, fromRole: string, role: string) {
    return await AccountModel.findOneAndUpdate(
      { _id: id, role: fromRole },
      { $set: { role } },
      { new: true }
    ).select("-password");
  }

  /** Succeeds only when the account is not already suspended. */
  static async suspendIf(id: string, suspendedBy: string, reason: string) {
    return await AccountModel.findOneAndUpdate(
      { _id: id, isSuspended: { $ne: true } },
      {
        $set: {
          isSuspended: true,
          suspendedAt: new Date(),
          suspendedBy,
          suspensionReason: reason,
        },
      },
      { new: true }
    ).select("-password");
  }

  /** Succeeds only when the account is currently suspended. */
  static async unsuspendIf(id: string) {
    return await AccountModel.findOneAndUpdate(
      { _id: id, isSuspended: true },
      {
        $set: { isSuspended: false, suspendedBy: "", suspensionReason: "" },
        $unset: { suspendedAt: "" },
      },
      { new: true }
    ).select("-password");
  }

  static async countByRole(role: string) {
    return await AccountModel.countDocuments({ role });
  }

  static async checkEmailIfExist(email : string) {
    return await AccountModel.findOne({ email });
  }

  static async checkContactIfExist(contact : string) {
    return await AccountModel.findOne({ contact: { $in: [contact, `639${contact.slice(1)}`] } });
  }

  static async setResetCode(id: string, resetCodeHash: string, resetCodeExpires: Date) {
    return await AccountModel.findByIdAndUpdate(id, { resetCodeHash, resetCodeExpires }, { new: true });
  }

  static async clearResetCode(id: string) {
    return await AccountModel.findByIdAndUpdate(id, { $unset: { resetCodeHash: "", resetCodeExpires: "" } }, { new: true });
  }

  static async updatePassword(id: string, hashedPassword: string) {
    return await AccountModel.findByIdAndUpdate(id, { password: hashedPassword }, { new: true });
  }

  static async getResidentsWithSkills(filter: { skill?: string; serviceType?: string; availability?: string; location?: string; search?: string } = {}) {
    const query: Record<string, any> = { status: 'approved' };

    // Barangay staff accounts are not service marketplace providers.
    query.role = { $nin: [ROLES.SECRETARY, ROLES.SUPER_ADMIN] };

    if (filter.availability) query.availability = filter.availability;
    if (filter.location) query.providerLocation = { $regex: filter.location, $options: "i" };

    if (filter.skill) {
      query["skills.skill"] = { $regex: filter.skill, $options: "i" };
    }
    if (filter.serviceType) {
      query["skills.serviceTypes"] = { $regex: filter.serviceType, $options: "i" };
    }
    if (filter.search) {
      query.$or = [
        { name: { $regex: filter.search, $options: "i" } },
        { "skills.skill": { $regex: filter.search, $options: "i" } },
        { "skills.serviceTypes": { $regex: filter.search, $options: "i" } },
      ];
    }

    // Project to public marketplace fields only: never leak ID images,
    // hashes, census links or registration internals to resident clients.
    const accounts = await AccountModel.find(query)
      .select(
        "name nickname profile email contact address purok providerLocation providerDescription availability completedServices skills reviews status role",
      )
      .lean();

    return accounts.map((account) => {
      const reviews = account.reviews || [];
      const averageRating = reviews.length
        ? reviews.reduce((sum, r) => sum + r.star, 0) / reviews.length
        : 0;
      return {
        ...account,
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews: reviews.length,
      };
    });
  }

  static async updateAvailability(id: string, availability: "AVAILABLE" | "BUSY" | "NOT_AVAILABLE") {
    return await AccountModel.findByIdAndUpdate(id, { availability }, { new: true }).select('-password');
  }

  static async incrementCompletedServices(id: string) {
    return await AccountModel.findByIdAndUpdate(id, { $inc: { completedServices: 1 } }, { new: true });
  }

  static async addReview(id: string, review: {
    user: string;
    userProfile: string;
    star: number;
    skill: string;
    message: string;
  }) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { $push: { reviews: review } },
      { new: true }
    ).select('-password');
  }

  static async getAccountsForAI() {
    const accounts = await AccountModel.find({ role: "resident", status: "approved", isSuspended: { $ne: true } })
      .select("name email contact skills")
      .lean();

    return JSON.stringify(accounts, null, 2);
  }

}
