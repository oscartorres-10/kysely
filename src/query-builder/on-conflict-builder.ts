import { ColumnNode } from '../operation-node/column-node.js'
import { IdentifierNode } from '../operation-node/identifier-node.js'
import { OnConflictNode } from '../operation-node/on-conflict-node.js'
import { OperationNodeSource } from '../operation-node/operation-node-source.js'
import { ComplexExpression } from '../parser/complex-expression-parser.js'
import {
  WhereGrouper,
  parseWhereFilter,
  FilterOperator,
  FilterValueExpressionOrList,
  parseReferenceFilter,
  parseExistFilter,
  parseNotExistFilter,
} from '../parser/filter-parser.js'
import { ParseContext } from '../parser/parse-context.js'
import { ReferenceExpression } from '../parser/reference-parser.js'
import {
  MutationObject,
  parseUpdateObject,
} from '../parser/update-set-parser.js'
import { RawBuilder } from '../raw-builder/raw-builder.js'
import { freeze } from '../util/object-utils.js'
import { preventAwait } from '../util/prevent-await.js'
import { AnyColumn, AnyRawBuilder } from '../util/type-utils.js'
import { WhereInterface } from './where-interface.js'

export class OnConflictBuilder<DB, TB extends keyof DB>
  implements WhereInterface<DB, TB>
{
  readonly #props: OnConflictBuilderProps

  constructor(props: OnConflictBuilderProps) {
    this.#props = freeze(props)
  }

  /**
   * Specify a single column as the conflict target.
   *
   * Also see the {@link columns}, {@link constraint} and {@link expression}
   * methods for alternative ways to specify the conflict target.
   */
  column(column: AnyColumn<DB, TB>): OnConflictBuilder<DB, TB> {
    const columnNode = ColumnNode.create(column)

    return new OnConflictBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWith(this.#props.onConflictNode, {
        columns: this.#props.onConflictNode.columns
          ? freeze([...this.#props.onConflictNode.columns, columnNode])
          : freeze([columnNode]),
      }),
    })
  }

  /**
   * Specify a list of columns as the conflict target.
   *
   * Also see the {@link column}, {@link constraint} and {@link expression}
   * methods for alternative ways to specify the conflict target.
   */
  columns(
    columns: ReadonlyArray<AnyColumn<DB, TB>>
  ): OnConflictBuilder<DB, TB> {
    const columnNodes = columns.map(ColumnNode.create)

    return new OnConflictBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWith(this.#props.onConflictNode, {
        columns: this.#props.onConflictNode.columns
          ? freeze([...this.#props.onConflictNode.columns, ...columnNodes])
          : freeze(columnNodes),
      }),
    })
  }

  /**
   * Specify a specific constraint by name as the conflict target.
   *
   * Also see the {@link column}, {@link columns} and {@link expression}
   * methods for alternative ways to specify the conflict target.
   */
  constraint(constraintName: string): OnConflictBuilder<DB, TB> {
    return new OnConflictBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWith(this.#props.onConflictNode, {
        constraint: IdentifierNode.create(constraintName),
      }),
    })
  }

  /**
   * Specify an expression as the conflict target.
   *
   * This can be used if the unique index is an expression index.
   *
   * Also see the {@link column}, {@link columns} and {@link constraint}
   * methods for alternative ways to specify the conflict target.
   */
  expression(expression: AnyRawBuilder): OnConflictBuilder<DB, TB> {
    return new OnConflictBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWith(this.#props.onConflictNode, {
        indexExpression: expression.toOperationNode(),
      }),
    })
  }

  /**
   * Specify an index predicate for the index target.
   *
   * See {@link WhereInterface.where} for more info.
   */
  where<RE extends ReferenceExpression<DB, TB>>(
    lhs: RE,
    op: FilterOperator,
    rhs: FilterValueExpressionOrList<DB, TB, RE>
  ): OnConflictBuilder<DB, TB>

  where(grouper: WhereGrouper<DB, TB>): OnConflictBuilder<DB, TB>
  where(raw: AnyRawBuilder): OnConflictBuilder<DB, TB>

  where(...args: any[]): OnConflictBuilder<DB, TB> {
    return new OnConflictBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithIndexWhere(
        this.#props.onConflictNode,
        parseWhereFilter(this.#props.parseContext, args)
      ),
    })
  }

  /**
   * Specify an index predicate for the index target.
   *
   * See {@link WhereInterface.whereRef} for more info.
   */
  whereRef(
    lhs: ReferenceExpression<DB, TB>,
    op: FilterOperator,
    rhs: ReferenceExpression<DB, TB>
  ): OnConflictBuilder<DB, TB> {
    return new OnConflictBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithIndexWhere(
        this.#props.onConflictNode,
        parseReferenceFilter(this.#props.parseContext, lhs, op, rhs)
      ),
    })
  }

  /**
   * Specify an index predicate for the index target.
   *
   * See {@link WhereInterface.orWhere} for more info.
   */
  orWhere<RE extends ReferenceExpression<DB, TB>>(
    lhs: RE,
    op: FilterOperator,
    rhs: FilterValueExpressionOrList<DB, TB, RE>
  ): OnConflictBuilder<DB, TB>
  orWhere(grouper: WhereGrouper<DB, TB>): OnConflictBuilder<DB, TB>
  orWhere(raw: AnyRawBuilder): OnConflictBuilder<DB, TB>

  orWhere(...args: any[]): OnConflictBuilder<DB, TB> {
    return new OnConflictBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithIndexOrWhere(
        this.#props.onConflictNode,
        parseWhereFilter(this.#props.parseContext, args)
      ),
    })
  }

  /**
   * Specify an index predicate for the index target.
   *
   * See {@link WhereInterface.orWhereRef} for more info.
   */
  orWhereRef(
    lhs: ReferenceExpression<DB, TB>,
    op: FilterOperator,
    rhs: ReferenceExpression<DB, TB>
  ): OnConflictBuilder<DB, TB> {
    return new OnConflictBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithIndexOrWhere(
        this.#props.onConflictNode,
        parseReferenceFilter(this.#props.parseContext, lhs, op, rhs)
      ),
    })
  }

  /**
   * Specify an index predicate for the index target.
   *
   * See {@link WhereInterface.whereExists} for more info.
   */
  whereExists(arg: ComplexExpression<DB, TB>): OnConflictBuilder<DB, TB> {
    return new OnConflictBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithIndexWhere(
        this.#props.onConflictNode,
        parseExistFilter(this.#props.parseContext, arg)
      ),
    })
  }

  /**
   * Specify an index predicate for the index target.
   *
   * See {@link WhereInterface.whereNotExists} for more info.
   */
  whereNotExists(arg: ComplexExpression<DB, TB>): OnConflictBuilder<DB, TB> {
    return new OnConflictBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithIndexWhere(
        this.#props.onConflictNode,
        parseNotExistFilter(this.#props.parseContext, arg)
      ),
    })
  }

  /**
   * Specify an index predicate for the index target.
   *
   * See {@link WhereInterface.orWhereExists} for more info.
   */
  orWhereExists(arg: ComplexExpression<DB, TB>): OnConflictBuilder<DB, TB> {
    return new OnConflictBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithIndexOrWhere(
        this.#props.onConflictNode,
        parseExistFilter(this.#props.parseContext, arg)
      ),
    })
  }

  /**
   * Specify an index predicate for the index target.
   *
   * See {@link WhereInterface.orWhereNotExists} for more info.
   */
  orWhereNotExists(arg: ComplexExpression<DB, TB>): OnConflictBuilder<DB, TB> {
    return new OnConflictBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithIndexOrWhere(
        this.#props.onConflictNode,
        parseNotExistFilter(this.#props.parseContext, arg)
      ),
    })
  }

  /**
   * Adds the "do nothing" conflict action.
   *
   * ### Examples
   *
   * ```ts
   * await db
   *   .insertInto('person')
   *   .values({ id: db.generated, first_name, pic })
   *   .onConflict((oc) => oc
   *     .column('pic')
   *     .doNothing()
   *   )
   * ```
   *
   * The generated SQL (PostgreSQL):
   *
   * ```sql
   * insert into "person" ("first_name", "pic")
   * values ($1, $2)
   * on conflict ("pic") do nothing
   * ```
   */
  doNothing(): OnConflictDoNothingBuilder<DB, TB> {
    return new OnConflictDoNothingBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWith(this.#props.onConflictNode, {
        doNothing: true,
      }),
    })
  }

  /**
   * Adds the "do update set" conflict action.
   *
   * ### Examples
   *
   * ```ts
   * await db
   *   .insertInto('person')
   *   .values({ id: db.generated, first_name, pic })
   *   .onConflict((oc) => oc
   *     .column('pic')
   *     .doUpdateSet({ first_name })
   *   )
   * ```
   *
   * The generated SQL (PostgreSQL):
   *
   * ```sql
   * insert into "person" ("first_name", "pic")
   * values ($1, $2)
   * on conflict ("pic")
   * do update set "first_name" = $3
   * ```
   */
  doUpdateSet(
    updates: MutationObject<DB, TB>
  ): OnConflictUpdateBuilder<DB & Record<'excluded', DB[TB]>, TB | 'excluded'> {
    return new OnConflictUpdateBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWith(this.#props.onConflictNode, {
        updates: parseUpdateObject(this.#props.parseContext, updates),
      }),
    })
  }
}

export interface OnConflictBuilderProps {
  readonly onConflictNode: OnConflictNode
  readonly parseContext: ParseContext
}

preventAwait(OnConflictBuilder, "don't await OnConflictBuilder instances.")

export class OnConflictDoNothingBuilder<DB, TB extends keyof DB>
  implements OperationNodeSource
{
  readonly #props: OnConflictBuilderProps

  constructor(props: OnConflictBuilderProps) {
    this.#props = freeze(props)
  }

  toOperationNode(): OnConflictNode {
    return this.#props.onConflictNode
  }
}

preventAwait(
  OnConflictDoNothingBuilder,
  "don't await OnConflictDoNothingBuilder instances."
)

export class OnConflictUpdateBuilder<DB, TB extends keyof DB>
  implements WhereInterface<DB, TB>, OperationNodeSource
{
  readonly #props: OnConflictBuilderProps

  constructor(props: OnConflictBuilderProps) {
    this.#props = freeze(props)
  }

  /**
   * Specify a where condition for the update operation.
   *
   * See {@link WhereInterface.where} for more info.
   */
  where<RE extends ReferenceExpression<DB, TB>>(
    lhs: RE,
    op: FilterOperator,
    rhs: FilterValueExpressionOrList<DB, TB, RE>
  ): OnConflictUpdateBuilder<DB, TB>

  where(grouper: WhereGrouper<DB, TB>): OnConflictUpdateBuilder<DB, TB>
  where(raw: AnyRawBuilder): OnConflictUpdateBuilder<DB, TB>

  where(...args: any[]): OnConflictUpdateBuilder<DB, TB> {
    return new OnConflictUpdateBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithUpdateWhere(
        this.#props.onConflictNode,
        parseWhereFilter(this.#props.parseContext, args)
      ),
    })
  }

  /**
   * Specify a where condition for the update operation.
   *
   * See {@link WhereInterface.whereRef} for more info.
   */
  whereRef(
    lhs: ReferenceExpression<DB, TB>,
    op: FilterOperator,
    rhs: ReferenceExpression<DB, TB>
  ): OnConflictUpdateBuilder<DB, TB> {
    return new OnConflictUpdateBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithUpdateWhere(
        this.#props.onConflictNode,
        parseReferenceFilter(this.#props.parseContext, lhs, op, rhs)
      ),
    })
  }

  /**
   * Specify a where condition for the update operation.
   *
   * See {@link WhereInterface.orWhere} for more info.
   */
  orWhere<RE extends ReferenceExpression<DB, TB>>(
    lhs: RE,
    op: FilterOperator,
    rhs: FilterValueExpressionOrList<DB, TB, RE>
  ): OnConflictUpdateBuilder<DB, TB>
  orWhere(grouper: WhereGrouper<DB, TB>): OnConflictUpdateBuilder<DB, TB>
  orWhere(raw: AnyRawBuilder): OnConflictUpdateBuilder<DB, TB>

  orWhere(...args: any[]): OnConflictUpdateBuilder<DB, TB> {
    return new OnConflictUpdateBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithUpdateOrWhere(
        this.#props.onConflictNode,
        parseWhereFilter(this.#props.parseContext, args)
      ),
    })
  }

  /**
   * Specify a where condition for the update operation.
   *
   * See {@link WhereInterface.orWhereRef} for more info.
   */
  orWhereRef(
    lhs: ReferenceExpression<DB, TB>,
    op: FilterOperator,
    rhs: ReferenceExpression<DB, TB>
  ): OnConflictUpdateBuilder<DB, TB> {
    return new OnConflictUpdateBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithUpdateOrWhere(
        this.#props.onConflictNode,
        parseReferenceFilter(this.#props.parseContext, lhs, op, rhs)
      ),
    })
  }

  /**
   * Specify a where condition for the update operation.
   *
   * See {@link WhereInterface.whereExists} for more info.
   */
  whereExists(arg: ComplexExpression<DB, TB>): OnConflictUpdateBuilder<DB, TB> {
    return new OnConflictUpdateBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithUpdateWhere(
        this.#props.onConflictNode,
        parseExistFilter(this.#props.parseContext, arg)
      ),
    })
  }

  /**
   * Specify a where condition for the update operation.
   *
   * See {@link WhereInterface.whereNotExists} for more info.
   */
  whereNotExists(
    arg: ComplexExpression<DB, TB>
  ): OnConflictUpdateBuilder<DB, TB> {
    return new OnConflictUpdateBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithUpdateWhere(
        this.#props.onConflictNode,
        parseNotExistFilter(this.#props.parseContext, arg)
      ),
    })
  }

  /**
   * Specify a where condition for the update operation.
   *
   * See {@link WhereInterface.orWhereExists} for more info.
   */
  orWhereExists(
    arg: ComplexExpression<DB, TB>
  ): OnConflictUpdateBuilder<DB, TB> {
    return new OnConflictUpdateBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithUpdateOrWhere(
        this.#props.onConflictNode,
        parseExistFilter(this.#props.parseContext, arg)
      ),
    })
  }

  /**
   * Specify a where condition for the update operation.
   *
   * See {@link WhereInterface.orWhereNotExists} for more info.
   */
  orWhereNotExists(
    arg: ComplexExpression<DB, TB>
  ): OnConflictUpdateBuilder<DB, TB> {
    return new OnConflictUpdateBuilder({
      ...this.#props,
      onConflictNode: OnConflictNode.cloneWithUpdateOrWhere(
        this.#props.onConflictNode,
        parseNotExistFilter(this.#props.parseContext, arg)
      ),
    })
  }

  toOperationNode(): OnConflictNode {
    return this.#props.onConflictNode
  }
}

preventAwait(
  OnConflictUpdateBuilder,
  "don't await OnConflictUpdateBuilder instances."
)