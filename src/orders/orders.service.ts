import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RpcException } from '@nestjs/microservices';
import { ChangeStatusOrderDto, CreateOrderDto, PaginationOrderDto } from './dto';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
	private readonly logger = new Logger(OrdersService.name);

	async onModuleInit() {
		await this.$connect();
		this.logger.log(`Database connected`);
	}

	create(createOrderDto: CreateOrderDto) {
		return this.order.create({ data: createOrderDto });
	}

	async findAll(paginationDto: PaginationOrderDto) {
		const where = { status: paginationDto.status };

		console.log(where);

		const totalPages = await this.order.count({
			where,
		});

		const currentPage = paginationDto.page;
		const perPage = paginationDto.limit;

		const data = await this.order.findMany({
			skip: (currentPage - 1) * perPage,
			take: perPage,
			where,
		});

		return { data, meta: { total: totalPages, page: currentPage, lastPage: Math.ceil(totalPages / perPage) } };
	}

	async findOne(id: string) {
		const order = await this.order.findFirst({ where: { id } });

		if (!order) {
			throw new RpcException({
				message: `Orders with id ${id} not found`,
				status: HttpStatus.NOT_FOUND,
			});
		}

		return order;
	}

	async changeOrderStatus(changeStatusOrderDto: ChangeStatusOrderDto) {
		const { id, status } = changeStatusOrderDto;

		const order = await this.findOne(id);

		if (order.status === status) {
			return order;
		}

		return this.order.update({ where: { id }, data: { status } });
	}
}
