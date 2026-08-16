import mongoose from 'mongoose';
import { UsageLog, Subscription, Plan, Vehicle, Driver, User, IUsageLog } from '../models';

/**
 * Usage Service
 * Tracks resource consumption against subscription limits
 */
export class UsageService {
  /**
   * Track usage for a resource type
   */
  async trackUsage(
    tenantId: string | mongoose.Types.ObjectId,
    resourceType: 'vehicles' | 'drivers' | 'users'
  ): Promise<IUsageLog> {
    try {
      const subscription = await Subscription.findOne({ tenantId }).populate('planId');
      if (!subscription) throw new Error('Subscription not found');

      const plan = subscription.planId as any;
      const currentUsage = await this.getResourceCount(tenantId, resourceType);
      const limit = plan.limits[`max${this.capitalize(resourceType)}`];

      let log = await UsageLog.findOne({ tenantId, resourceType });
      if (!log) {
        log = new UsageLog({
          tenantId,
          resourceType,
          currentUsage,
          limit,
          timestamp: new Date()
        });
      } else {
        log.currentUsage = currentUsage;
        log.limit = limit;
        log.timestamp = new Date();
      }

      return await log.save();
    } catch (error) {
      console.error('Error tracking usage:', error);
      throw error;
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(tenantId: string | mongoose.Types.ObjectId): Promise<{
    vehicles: { current: number; limit: number; percentageUsed: number };
    drivers: { current: number; limit: number; percentageUsed: number };
    users: { current: number; limit: number; percentageUsed: number };
  }> {
    try {
      const subscription = await Subscription.findOne({ tenantId }).populate('planId');
      if (!subscription) throw new Error('Subscription not found');

      const plan = subscription.planId as any;

      const [vehicleCount, driverCount, userCount] = await Promise.all([
        Vehicle.countDocuments({ tenantId }),
        Driver.countDocuments({ tenantId }),
        User.countDocuments({ tenantId })
      ]);

      return {
        vehicles: {
          current: vehicleCount,
          limit: plan.limits.maxVehicles,
          percentageUsed: Math.round((vehicleCount / plan.limits.maxVehicles) * 100)
        },
        drivers: {
          current: driverCount,
          limit: plan.limits.maxDrivers,
          percentageUsed: Math.round((driverCount / plan.limits.maxDrivers) * 100)
        },
        users: {
          current: userCount,
          limit: plan.limits.maxUsers,
          percentageUsed: Math.round((userCount / plan.limits.maxUsers) * 100)
        }
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      throw error;
    }
  }

  /**
   * Check if resource creation is allowed
   */
  async canCreateResource(tenantId: string | mongoose.Types.ObjectId, resourceType: string): Promise<boolean> {
    try {
      const stats = await this.getUsageStats(tenantId);
      const resource = (stats as any)[resourceType];
      if (!resource) return false;
      return resource.current < resource.limit;
    } catch (error) {
      console.error('Error checking resource limit:', error);
      return false;
    }
  }

  /**
   * Get all usage logs for tenant
   */
  async getUsageLogs(tenantId: string | mongoose.Types.ObjectId): Promise<IUsageLog[]> {
    try {
      const logs = await UsageLog.find({ tenantId }).sort({ timestamp: -1 });
      return logs;
    } catch (error) {
      console.error('Error fetching usage logs:', error);
      throw error;
    }
  }

  /**
   * Get resource count
   */
  private async getResourceCount(tenantId: string | mongoose.Types.ObjectId, resourceType: string): Promise<number> {
    try {
      const objId = new mongoose.Types.ObjectId(tenantId.toString());

      switch (resourceType.toLowerCase()) {
        case 'vehicles':
          return await Vehicle.countDocuments({ tenantId: objId });
        case 'drivers':
          return await Driver.countDocuments({ tenantId: objId });
        case 'users':
          return await User.countDocuments({ tenantId: objId });
        default:
          return 0;
      }
    } catch (error) {
      console.error('Error getting resource count:', error);
      return 0;
    }
  }

  /**
   * Capitalize string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export default new UsageService();
