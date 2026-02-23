import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { MetricEventDto, MetricEventType } from '../dto/metric-event.dto';

@Injectable()
export class DashboardEventService {
  private eventSubject = new Subject<MetricEventDto>();

  emitMetricUpdate(metricType: string, data: any): void {
    this.eventSubject.next({
      type: MetricEventType.MetricUpdate,
      timestamp: new Date(),
      data: { metric: metricType, ...data },
    });
  }

  emitUserRegistered(userId: string, email: string): void {
    this.eventSubject.next({
      type: MetricEventType.UserRegistered,
      timestamp: new Date(),
      data: { userId, email },
    });
  }

  emitFeatureUsed(userId: string, module: string, actionType: string): void {
    this.eventSubject.next({
      type: MetricEventType.FeatureUsed,
      timestamp: new Date(),
      data: { userId, module, actionType },
    });
  }

  emitHeartbeat(): void {
    this.eventSubject.next({
      type: MetricEventType.Heartbeat,
      timestamp: new Date(),
      data: {},
    });
  }

  getEventStream(): Observable<MetricEventDto> {
    return this.eventSubject.asObservable();
  }
}






