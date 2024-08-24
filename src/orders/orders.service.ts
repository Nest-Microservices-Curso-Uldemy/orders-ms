import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { ChangeStatusOrderDto, CreateOrderDto, PaginationOrderDto, PaidOrderDto } from './dto';
import { NATS_SERVICE } from 'src/config';
import { firstValueFrom } from 'rxjs';
import { OrderWithProducts } from './interfaces/order-with-products.interface';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
	private readonly logger = new Logger(OrdersService.name);

	constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {
		super();
	}

	async onModuleInit() {
		await this.$connect();
		this.logger.log(`Database connected`);
	}

	async create(createOrderDto: CreateOrderDto) {
		try {
			const productIds = createOrderDto.items.map((item) => item.productId);

			const products = await this.obtenerProductos(productIds);

			const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {
				const price = products.find((product) => product.id == orderItem.productId).price;

				acc += price * orderItem.quantity;
				return acc;
			}, 0);

			const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
				return acc + orderItem.quantity;
			}, 0);

			//3. Crear una transación de base de datos
			const order = await this.order.create({
				data: {
					totalAmount: totalAmount,
					totalItems: totalItems,
					orderItem: {
						createMany: {
							data: createOrderDto.items.map((orderItem) => {
								return {
									price: products.find((product) => product.id == orderItem.productId).price,
									productId: orderItem.productId,
									quantity: orderItem.quantity,
								};
							}),
						},
					},
				},
				include: {
					orderItem: {
						select: {
							price: true,
							quantity: true,
							productId: true,
						},
					},
				},
			});

			return {
				...order,
				orderItem: order.orderItem.map((item) => {
					return {
						...item,
						name: products.find((product) => product.id == item.productId).name,
					};
				}),
			};
		} catch (error) {
			throw new RpcException({
				status: HttpStatus.BAD_REQUEST,
				message: 'Check logs',
			});
		}
	}

	async findAll(paginationDto: PaginationOrderDto) {
		const where = { status: paginationDto.status };

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
		const order = await this.order.findFirst({
			where: { id },
			include: {
				orderItem: {
					select: {
						price: true,
						quantity: true,
						productId: true,
					},
				},
			},
		});

		const productIds = order.orderItem.map((item) => item.productId);

		const products = await this.obtenerProductos(productIds);

		if (!order) {
			throw new RpcException({
				message: `Orders with id ${id} not found`,
				status: HttpStatus.NOT_FOUND,
			});
		}

		return {
			...order,
			orderItem: order.orderItem.map((item) => {
				return {
					...item,
					name: products.find((product) => product.id == item.productId).name,
				};
			}),
		};
	}

	async changeOrderStatus(changeStatusOrderDto: ChangeStatusOrderDto) {
		const { id, status } = changeStatusOrderDto;

		const order = await this.findOne(id);

		if (order.status === status) {
			return order;
		}

		return this.order.update({ where: { id }, data: { status } });
	}

	private async obtenerProductos(productIds: number[]): Promise<any[]> {
		return await firstValueFrom(this.client.send({ cmd: 'validate_products' }, productIds));
	}

	async createPaymentSession(order: OrderWithProducts) {
		const paymentSession = await firstValueFrom(
			this.client.send('create.payment.session', {
				orderId: order.id,
				currency: 'EUR',
				items: order.orderItem.map((item) => ({
					name: item.name,
					price: item.price,
					quantity: item.quantity,
				})),
			}),
		);
		return paymentSession;
	}

	async paidOrder(paidOrderDto: PaidOrderDto) {
		this.logger.log('Order Paid');
		this.logger.log(paidOrderDto);

		await this.order.update({
			where: { id: paidOrderDto.orderId },
			data: {
				status: 'PAID',
				paid: true,
				paidAt: new Date(),
				stripeChargeId: paidOrderDto.stripePaymentId,
				orderReceipt: {
					create: {
						receiptUrl: paidOrderDto.receiptUrl,
					},
				},
			},
		});
	}
}
