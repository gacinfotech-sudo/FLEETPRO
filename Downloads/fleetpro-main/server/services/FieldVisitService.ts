import mongoose from 'mongoose';
import { FieldVisit, ServiceTicket, Vehicle, Driver } from '../models/index';
import { IFieldVisit } from '../models/index';
import { nanoid } from 'nanoid';

interface CreateFieldVisitDTO {
  tenantId: mongoose.Types.ObjectId;
  ticketId: mongoose.Types.ObjectId;
  engineerId: mongoose.Types.ObjectId;
  engineerName: string;
  assetId: mongoose.Types.ObjectId;
  visitDate: Date;
  diagnosis: string;
  actionTaken: 'REPAIR' | 'REPLACEMENT' | 'NO_ACTION' | 'REFER_TO_VENDOR';
  assetConditionBefore: string;
  assetConditionAfter?: string;
  partsUsed?: {
    partName: string;
    quantity: number;
    cost: number;
  }[];
  laborCost?: number;
}

interface PhotoUploadDTO {
  url: string;
  description: string;
}

export class FieldVisitService {
  /**
   * Create a new field visit
   */
  async createFieldVisit(data: CreateFieldVisitDTO): Promise<IFieldVisit> {
    // Validate ticket exists
    const ticket = await ServiceTicket.findById(data.ticketId);
    if (!ticket) {
      throw new Error(`Ticket not found: ${data.ticketId}`);
    }

    // Validate asset exists
    const asset = await Vehicle.findById(data.assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${data.assetId}`);
    }

    const visitId = `VIS-${Date.now()}-${nanoid(6)}`;

    // Calculate costs
    let totalCost = 0;
    let partsUsed = data.partsUsed || [];

    if (partsUsed.length > 0) {
      totalCost += partsUsed.reduce((sum, part) => sum + part.cost, 0);
    }

    if (data.laborCost) {
      totalCost += data.laborCost;
    }

    const fieldVisit = new FieldVisit({
      tenantId: data.tenantId,
      visitId,
      ticketId: data.ticketId,
      engineerId: data.engineerId,
      engineerName: data.engineerName,
      assetId: data.assetId,
      visitDate: data.visitDate,
      diagnosis: data.diagnosis,
      actionTaken: data.actionTaken,
      assetConditionBefore: data.assetConditionBefore,
      assetConditionAfter: data.assetConditionAfter,
      partsUsed,
      laborCost: data.laborCost || 0,
      totalCost,
      photos: [],
      notes: '',
      createdAt: new Date()
    });

    const savedVisit = await fieldVisit.save();

    // Add visit to ticket
    await (ticket as any).addToSet('fieldVisits', savedVisit._id);
    await ticket.save();

    return savedVisit;
  }

  /**
   * Get field visit by ID
   */
  async getFieldVisit(tenantId: mongoose.Types.ObjectId, visitId: string): Promise<IFieldVisit | null> {
    const visit = await FieldVisit.findOne({
      tenantId,
      _id: visitId
    }).populate('ticketId engineerId assetId');

    return visit;
  }

  /**
   * Get field visits for a ticket
   */
  async getFieldVisitsByTicket(
    tenantId: mongoose.Types.ObjectId,
    ticketId: mongoose.Types.ObjectId
  ): Promise<IFieldVisit[]> {
    const visits = await FieldVisit.find({
      tenantId,
      ticketId
    }).sort({ createdAt: -1 });

    return visits;
  }

  /**
   * Upload photo to field visit
   */
  async uploadPhoto(
    tenantId: mongoose.Types.ObjectId,
    visitId: string,
    photo: PhotoUploadDTO
  ): Promise<IFieldVisit> {
    const visit = await FieldVisit.findOne({
      tenantId,
      _id: visitId
    });

    if (!visit) {
      throw new Error(`Field visit not found: ${visitId}`);
    }

    if (!visit.photos) {
      visit.photos = [];
    }

    visit.photos.push({
      url: photo.url,
      description: photo.description,
      timestamp: new Date()
    });

    return await visit.save();
  }

  /**
   * Record diagnosis for field visit
   */
  async recordDiagnosis(
    tenantId: mongoose.Types.ObjectId,
    visitId: string,
    diagnosis: string,
    assetConditionAfter?: string
  ): Promise<IFieldVisit> {
    const visit = await FieldVisit.findOne({
      tenantId,
      _id: visitId
    });

    if (!visit) {
      throw new Error(`Field visit not found: ${visitId}`);
    }

    visit.diagnosis = diagnosis;
    if (assetConditionAfter) {
      visit.assetConditionAfter = assetConditionAfter;
    }

    return await visit.save();
  }

  /**
   * Record action taken (repair/replacement/etc)
   */
  async recordAction(
    tenantId: mongoose.Types.ObjectId,
    visitId: string,
    actionTaken: 'REPAIR' | 'REPLACEMENT' | 'NO_ACTION' | 'REFER_TO_VENDOR',
    partsUsed?: { partName: string; quantity: number; cost: number }[],
    laborCost?: number,
    notes?: string
  ): Promise<IFieldVisit> {
    const visit = await FieldVisit.findOne({
      tenantId,
      _id: visitId
    });

    if (!visit) {
      throw new Error(`Field visit not found: ${visitId}`);
    }

    visit.actionTaken = actionTaken;
    if (notes) visit.notes = notes;

    // Update parts used
    if (partsUsed) {
      visit.partsUsed = partsUsed;
    }

    // Update labor cost
    if (laborCost !== undefined) {
      visit.laborCost = laborCost;
    }

    // Recalculate total cost
    let totalCost = 0;
    if (visit.partsUsed && visit.partsUsed.length > 0) {
      totalCost += visit.partsUsed.reduce((sum, part) => sum + part.cost, 0);
    }
    if (visit.laborCost) {
      totalCost += visit.laborCost;
    }
    visit.totalCost = totalCost;

    return await visit.save();
  }

  /**
   * Record check-in time
   */
  async recordCheckIn(
    tenantId: mongoose.Types.ObjectId,
    visitId: string
  ): Promise<IFieldVisit> {
    const visit = await FieldVisit.findOne({
      tenantId,
      _id: visitId
    });

    if (!visit) {
      throw new Error(`Field visit not found: ${visitId}`);
    }

    visit.checkInTime = new Date();
    return await visit.save();
  }

  /**
   * Record check-out time
   */
  async recordCheckOut(
    tenantId: mongoose.Types.ObjectId,
    visitId: string
  ): Promise<IFieldVisit> {
    const visit = await FieldVisit.findOne({
      tenantId,
      _id: visitId
    });

    if (!visit) {
      throw new Error(`Field visit not found: ${visitId}`);
    }

    visit.checkOutTime = new Date();
    return await visit.save();
  }

  /**
   * Get engineer field visits
   */
  async getEngineerVisits(
    tenantId: mongoose.Types.ObjectId,
    engineerId: mongoose.Types.ObjectId,
    startDate?: Date,
    endDate?: Date
  ): Promise<IFieldVisit[]> {
    const query: any = {
      tenantId,
      engineerId
    };

    if (startDate || endDate) {
      query.visitDate = {};
      if (startDate) query.visitDate.$gte = startDate;
      if (endDate) query.visitDate.$lte = endDate;
    }

    const visits = await FieldVisit.find(query)
      .populate('ticketId')
      .sort({ visitDate: -1 });

    return visits;
  }

  /**
   * Get service history for asset
   */
  async getAssetServiceHistory(
    tenantId: mongoose.Types.ObjectId,
    assetId: mongoose.Types.ObjectId
  ): Promise<{
    tickets: any[];
    visits: IFieldVisit[];
    totalRepairs: number;
    totalCost: number;
  }> {
    const visits = await FieldVisit.find({
      tenantId,
      assetId
    }).populate('ticketId').sort({ createdAt: -1 });

    const tickets = await ServiceTicket.find({
      tenantId,
      assetId,
      status: { $in: ['RESOLVED', 'CLOSED'] }
    }).sort({ createdAt: -1 });

    const totalRepairs = visits.length;
    const totalCost = visits.reduce((sum, visit) => sum + visit.totalCost, 0);

    return {
      tickets,
      visits,
      totalRepairs,
      totalCost
    };
  }
}
