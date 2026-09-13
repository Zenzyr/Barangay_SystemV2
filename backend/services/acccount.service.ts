import AccountModel from "../model/account.model"
import { accountInterface, accountInterfaceInput } from "../types/accounts.type";


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

  static async updateRole(id: string, role: string) {
    return await AccountModel.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    );
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

    const accounts = await AccountModel.find(query)
      .select('-password')
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
    const accounts = await AccountModel.find()
      .select("name email contact skills")
      .lean();

    return JSON.stringify(accounts, null, 2);
  }

}
