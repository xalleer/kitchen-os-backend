import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ProductsImportService } from './products-import.service';

@Injectable()
export class ProductsImportTask {
  private readonly logger = new Logger(ProductsImportTask.name);

  constructor(private readonly productsImportService: ProductsImportService) {}

  // Запускається кожного дня о 3:00 ночі
  @Cron('0 3 * * *', {
    name: 'import-products',
    timeZone: 'Europe/Kyiv', // UTC+2 (можна змінити на потрібну часову зону)
  })
  async handleCron() {
    this.logger.log('🚀 Автоматичний запуск імпорту продуктів о 3:00 ночі');
    
    const result = await this.productsImportService.importProductsFromJson();
    
    if (result.success) {
      this.logger.log(
        `✅ Автоматичний імпорт завершено: створено ${result.created}, пропущено ${result.skipped} з ${result.total} продуктів`,
      );
    } else {
      this.logger.error(`❌ Помилка автоматичного імпорту: ${result.error}`);
    }
  }
}
