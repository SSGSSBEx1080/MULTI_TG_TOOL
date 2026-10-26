from __future__ import annotations

import ast
import ipaddress
import math
import operator
import re
from typing import Any

SAFE_CONSTANTS: dict[str, float] = {
    "pi": math.pi,
    "e": math.e,
    "tau": math.tau,
    "phi": (1 + math.sqrt(5)) / 2,
}

SAFE_FUNCTIONS: dict[str, Any] = {
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "asin": math.asin,
    "acos": math.acos,
    "atan": math.atan,
    "sqrt": math.sqrt,
    "log": math.log,
    "log10": math.log10,
    "log2": math.log2,
    "exp": math.exp,
    "abs": abs,
    "round": round,
    "floor": math.floor,
    "ceil": math.ceil,
    "fact": lambda n: math.factorial(min(int(n), 170)),
    "factorial": lambda n: math.factorial(min(int(n), 170)),
    "deg": math.degrees,
    "rad": math.radians,
    "gcd": lambda a, b: math.gcd(int(a), int(b)),
    "lcm": lambda a, b: math.lcm(int(a), int(b)),
    "xor": lambda a, b: int(a) ^ int(b),
    "bxor": lambda a, b: int(a) ^ int(b),
    "pow": pow,
    "min": min,
    "max": max,
}

BINARY_OPS: dict[type, Any] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.BitAnd: operator.and_,
    ast.BitOr: operator.or_,
    ast.BitXor: operator.xor,
    ast.LShift: lambda a, b: int(a) << min(int(b), 64),
    ast.RShift: lambda a, b: int(a) >> min(int(b), 64),
}

UNARY_OPS: dict[type, Any] = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
    ast.Invert: lambda a: ~int(a),
}


def _eval_node(node: ast.AST) -> float | int:
    if isinstance(node, ast.Expression):
        return _eval_node(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.Name):
        name = node.id.lower()
        if name in SAFE_CONSTANTS:
            return SAFE_CONSTANTS[name]
        raise ValueError(f"Неизвестная константа: {node.id}")
    if isinstance(node, ast.BinOp):
        left = _eval_node(node.left)
        right = _eval_node(node.right)
        if isinstance(node.op, ast.Pow):
            if abs(right) > 1000:
                raise ValueError("Слишком большая степень (> 1000)")
            return left**right
        if isinstance(node.op, (ast.BitAnd, ast.BitOr, ast.BitXor, ast.LShift, ast.RShift)):
            if isinstance(left, float) and left.is_integer():
                left = int(left)
            if isinstance(right, float) and right.is_integer():
                right = int(right)
            if not isinstance(left, int) or not isinstance(right, int):
                raise ValueError("Побитовые операции поддерживают только целые числа")
        op_fn = BINARY_OPS.get(type(node.op))
        if op_fn is None:
            raise ValueError("Оператор не поддерживается")
        return op_fn(left, right)
    if isinstance(node, ast.UnaryOp):
        operand = _eval_node(node.operand)
        u_fn = UNARY_OPS.get(type(node.op))
        if u_fn is None:
            raise ValueError("Унарный оператор не поддерживается")
        return u_fn(operand)
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
        fn_name = node.func.id.lower()
        fn = SAFE_FUNCTIONS.get(fn_name)
        if fn is None:
            raise ValueError(f"Функция '{node.func.id}' не разрешена")
        args = [_eval_node(arg) for arg in node.args]
        return fn(*args)
    raise ValueError("Недопустимая конструкция в выражении")


def evaluate_math(expression: str) -> dict[str, Any]:
    expr = (expression or "").strip()
    if not expr:
        raise ValueError("Пустое математическое выражение")
    normalized = expr.replace("×", "*").replace("÷", "/").replace("−", "-")
    # Convert decimal/algebraic ^ to exponentiation **; preserve bitwise ^ between explicit 0x/0b literals
    normalized = re.sub(
        r"(?<!0x)(?<!0X)(?<!0b)(?<!0B)(\b\d+(?:\.\d+)?|\))\s*\^\s*(?!0x|0X|0b|0B)",
        r"\1 ** ",
        normalized,
    )
    if "0x" not in normalized.lower() and "0b" not in normalized.lower():
        normalized = normalized.replace("^", "**")

    tree = ast.parse(normalized, mode="eval")
    result = _eval_node(tree)

    if isinstance(result, float) and result.is_integer() and abs(result) < 10**18:
        result = int(result)

    representations: dict[str, str] = {}
    if isinstance(result, int):
        formatted = f"{result:,}".replace(",", " ")
        representations = {
            "hex": hex(result),
            "bin": bin(result),
            "oct": oct(result),
        }
    else:
        formatted = f"{result:.10g}"

    return {
        "expression": expr,
        "result": result,
        "formatted": formatted,
        "bases": representations,
    }


UNIT_TABLES: dict[str, dict[str, float]] = {
    "length": {
        "mm": 0.001, "cm": 0.01, "m": 1.0, "km": 1000.0,
        "in": 0.0254, "ft": 0.3048, "yd": 0.9144, "mi": 1609.344,
    },
    "weight": {
        "mg": 0.000001, "g": 0.001, "kg": 1.0, "t": 1000.0,
        "oz": 0.0283495231, "lb": 0.45359237,
    },
    "data": {
        "B": 1.0, "KB": 1024.0, "MB": 1024.0**2, "GB": 1024.0**3, "TB": 1024.0**4, "PB": 1024.0**5,
    },
    "speed": {
        "m/s": 1.0, "km/h": 1.0 / 3.6, "mph": 0.44704, "kn": 0.514444,
    },
    "area": {
        "sq_m": 1.0, "ha": 10_000.0, "sq_km": 1_000_000.0, "sq_ft": 0.092903, "acre": 4046.856,
    },
}


def convert_units(value: float, category: str, from_unit: str, to_unit: str = "") -> dict[str, Any]:
    cat = category.lower().strip()
    if cat == "temperature":
        f_u = from_unit.upper().strip()
        if f_u == "C":
            c = value
        elif f_u == "F":
            c = (value - 32) * 5 / 9
        elif f_u == "K":
            c = value - 273.15
        else:
            raise ValueError("Единица температуры должна быть C, F или K")
        conversions = {
            "C": round(c, 3),
            "F": round(c * 9 / 5 + 32, 3),
            "K": round(c + 273.15, 3),
        }
        return {"category": "temperature", "from": f"{value} °{f_u}", "all": conversions}

    table = UNIT_TABLES.get(cat)
    if not table:
        raise ValueError(f"Неизвестная категория величин: {category}")
    if from_unit not in table:
        raise ValueError(f"Неизвестная исходная единица: {from_unit}")

    base_val = value * table[from_unit]
    all_conv = {u: round(base_val / factor, 6) for u, factor in table.items()}
    single = all_conv.get(to_unit) if to_unit in all_conv else None
    return {
        "category": cat,
        "from": f"{value} {from_unit}",
        "target_unit": to_unit or None,
        "target_value": single,
        "all": all_conv,
    }


def _annuity_payment(principal: float, monthly_rate: float, months: int) -> float:
    if monthly_rate == 0:
        return principal / months
    factor = (1.0 + monthly_rate) ** months
    return principal * (monthly_rate * factor) / (factor - 1.0)


def _loan_schedule(principal: float, monthly_rate: float, months: int, base_payment: float, extra_payment: float) -> list[dict[str, float | int]]:
    balance = round(principal, 2)
    schedule: list[dict[str, float | int]] = []
    for month in range(1, months + 1):
        if balance <= 0:
            break
        interest = round(balance * monthly_rate, 2)
        due = round(balance + interest, 2)
        regular = min(round(base_payment, 2), due)
        extra = min(round(extra_payment, 2), max(0.0, due - regular))
        payment = round(regular + extra, 2)
        principal_paid = round(payment - interest, 2)
        balance = max(0.0, round(balance - principal_paid, 2))
        if balance < 0.01:
            balance = 0.0
        schedule.append({
            "month": month,
            "payment": payment,
            "regular_payment": regular,
            "extra_payment": extra,
            "principal_paid": principal_paid,
            "interest_paid": interest,
            "remaining_balance": balance,
        })
    return schedule


def _differentiated_schedule(principal: float, monthly_rate: float, months: int, extra_payment: float) -> list[dict[str, float | int]]:
    balance = round(principal, 2)
    scheduled_principal = round(principal / months, 2)
    schedule: list[dict[str, float | int]] = []
    for month in range(1, months + 1):
        if balance <= 0:
            break
        interest = round(balance * monthly_rate, 2)
        due = round(balance + interest, 2)
        regular = min(round(scheduled_principal + interest, 2), due)
        extra = min(round(extra_payment, 2), max(0.0, due - regular))
        payment = round(regular + extra, 2)
        principal_paid = round(payment - interest, 2)
        balance = max(0.0, round(balance - principal_paid, 2))
        if balance < 0.01:
            balance = 0.0
        schedule.append({
            "month": month,
            "payment": payment,
            "regular_payment": regular,
            "extra_payment": extra,
            "principal_paid": principal_paid,
            "interest_paid": interest,
            "remaining_balance": balance,
        })
    return schedule


def calculate_loan_plan(
    principal: float,
    rate_annual_pct: float,
    months: int,
    monthly_extra_payment: float = 0.0,
    repayment_method: str = "annuity",
) -> dict[str, Any]:
    """Compare an annuity or differentiated schedule with extra principal payments."""
    values = (principal, rate_annual_pct, monthly_extra_payment)
    if any(not math.isfinite(float(value)) for value in values):
        raise ValueError("Сумма, ставка и досрочный платёж должны быть конечными числами")
    principal = float(principal)
    rate_annual_pct = float(rate_annual_pct)
    monthly_extra_payment = float(monthly_extra_payment)
    if not 0 < principal <= 100_000_000_000:
        raise ValueError("Сумма кредита должна быть больше нуля и не превышать 100 млрд")
    if not 0 <= rate_annual_pct <= 200:
        raise ValueError("Годовая ставка должна быть в диапазоне от 0 до 200%")
    if not 1 <= int(months) <= 600:
        raise ValueError("Срок должен быть от 1 до 600 месяцев")
    if not 0 <= monthly_extra_payment <= principal:
        raise ValueError("Досрочный ежемесячный платёж должен быть от 0 до суммы кредита")
    repayment_method = repayment_method.strip().lower()
    if repayment_method not in {"annuity", "differentiated"}:
        raise ValueError("Метод погашения должен быть annuity или differentiated")

    months = int(months)
    monthly_rate = (rate_annual_pct / 100.0) / 12.0
    annuity_payment = _annuity_payment(principal, monthly_rate, months)
    if repayment_method == "annuity":
        standard_schedule = _loan_schedule(principal, monthly_rate, months, annuity_payment, 0.0)
        schedule = _loan_schedule(principal, monthly_rate, months, annuity_payment, monthly_extra_payment)
    else:
        standard_schedule = _differentiated_schedule(principal, monthly_rate, months, 0.0)
        schedule = _differentiated_schedule(principal, monthly_rate, months, monthly_extra_payment)
    standard_interest = round(sum(float(row["interest_paid"]) for row in standard_schedule), 2)
    actual_interest = round(sum(float(row["interest_paid"]) for row in schedule), 2)
    total_paid = round(sum(float(row["payment"]) for row in schedule), 2)
    standard_total_paid = round(sum(float(row["payment"]) for row in standard_schedule), 2)
    regular_first_payment = float(standard_schedule[0]["regular_payment"])
    return {
        "mode": "loan",
        "repayment_method": repayment_method,
        "repayment_method_label": "Аннуитетный" if repayment_method == "annuity" else "Дифференцированный",
        "principal": round(principal, 2),
        "months": months,
        "rate_pct": rate_annual_pct,
        "monthly_payment": round(regular_first_payment, 2),
        "first_payment": round(float(schedule[0]["payment"]), 2),
        "last_payment": round(float(schedule[-1]["payment"]), 2),
        "monthly_extra_payment": round(monthly_extra_payment, 2),
        "total_paid": total_paid,
        "overpayment": actual_interest,
        "overpayment_pct": round(actual_interest / principal * 100.0, 2),
        "months_to_payoff": len(schedule),
        "months_saved": max(0, len(standard_schedule) - len(schedule)),
        "standard_total_paid": standard_total_paid,
        "standard_overpayment": standard_interest,
        "interest_saved": round(max(0.0, standard_interest - actual_interest), 2),
        "schedule": schedule,
    }


def calculate_savings_goal(
    initial_amount: float,
    monthly_contribution: float,
    target_amount: float,
    rate_annual_pct: float,
    months: int,
    inflation_annual_pct: float = 0.0,
) -> dict[str, Any]:
    values = (initial_amount, monthly_contribution, target_amount, rate_annual_pct, inflation_annual_pct)
    if any(not math.isfinite(float(value)) for value in values):
        raise ValueError("Параметры накоплений должны быть конечными числами")
    initial_amount, monthly_contribution, target_amount, rate_annual_pct, inflation_annual_pct = map(float, values)
    if not 0 <= initial_amount <= 100_000_000_000 or not 0 <= target_amount <= 100_000_000_000:
        raise ValueError("Начальная сумма и цель должны быть от 0 до 100 млрд")
    if not 0 <= monthly_contribution <= 1_000_000_000:
        raise ValueError("Ежемесячное пополнение должно быть от 0 до 1 млрд")
    if not 0 <= rate_annual_pct <= 200:
        raise ValueError("Годовая ставка должна быть в диапазоне от 0 до 200%")
    if not 0 <= inflation_annual_pct <= 200:
        raise ValueError("Инфляция должна быть в диапазоне от 0 до 200%")
    if not 1 <= int(months) <= 600:
        raise ValueError("Срок должен быть от 1 до 600 месяцев")
    months = int(months)
    monthly_rate = rate_annual_pct / 1200.0
    monthly_inflation = inflation_annual_pct / 1200.0
    growth_factor = (1.0 + monthly_rate) ** months
    inflation_factor = (1.0 + monthly_inflation) ** months
    target_at_horizon = target_amount * inflation_factor
    contribution_factor = months if monthly_rate == 0 else (growth_factor - 1.0) / monthly_rate
    initial_future_value = initial_amount * growth_factor
    projected_balance = initial_future_value + monthly_contribution * contribution_factor
    required_monthly = max(0.0, (target_at_horizon - initial_future_value) / contribution_factor)
    invested = initial_amount + monthly_contribution * months
    forecast_balance = initial_amount
    savings_schedule: list[dict[str, float | int]] = []
    for month in range(1, months + 1):
        forecast_balance = forecast_balance * (1.0 + monthly_rate) + monthly_contribution
        if month % 12 == 0 or month == months:
            milestone_inflation = (1.0 + monthly_inflation) ** month
            milestone_target = target_amount * milestone_inflation
            savings_schedule.append({
                "month": month,
                "projected_balance": round(forecast_balance, 2),
                "target_at_date": round(milestone_target, 2),
                "balance_in_today_rub": round(forecast_balance / milestone_inflation, 2),
                "difference_to_target": round(forecast_balance - milestone_target, 2),
            })
    running_balance = initial_amount
    estimated_months_to_goal: int | None = 0 if initial_amount >= target_amount else None
    for month in range(1, 601):
        running_balance = running_balance * (1.0 + monthly_rate) + monthly_contribution
        inflation_adjusted_goal = target_amount * ((1.0 + monthly_inflation) ** month)
        if running_balance >= inflation_adjusted_goal:
            estimated_months_to_goal = month
            break
    return {
        "mode": "goal",
        "target_amount_today": round(target_amount, 2),
        "target_amount_at_horizon": round(target_at_horizon, 2),
        "projected_balance": round(projected_balance, 2),
        "projected_balance_in_today_rub": round(projected_balance / inflation_factor, 2),
        "required_monthly_contribution": round(required_monthly, 2),
        "monthly_contribution": round(monthly_contribution, 2),
        "initial_amount_future_value": round(initial_future_value, 2),
        "total_invested": round(invested, 2),
        "estimated_growth": round(projected_balance - invested, 2),
        "target_difference": round(projected_balance - target_at_horizon, 2),
        "real_target_difference": round(projected_balance / inflation_factor - target_amount, 2),
        "estimated_months_to_goal": estimated_months_to_goal,
        "schedule": savings_schedule,
        "months": months,
        "rate_pct": rate_annual_pct,
        "inflation_pct": inflation_annual_pct,
        "assumption": "Ставка, инфляция и пополнения считаются постоянными; взносы вносятся в конце месяца. Налоги, комиссии и изменение условий не учтены.",
    }


def calculate_finance(
    mode: str,
    principal: float,
    rate_annual_pct: float = 16.0,
    months: int = 12,
    monthly_topup: float = 0.0,
    people_count: int = 2,
    tip_pct: float = 10.0,
    monthly_extra_payment: float = 0.0,
    target_amount: float = 1_000_000.0,
    repayment_method: str = "annuity",
    inflation_annual_pct: float = 0.0,
) -> dict[str, Any]:
    m = mode.lower().strip()
    if m == "split":
        ppl = max(1, int(people_count))
        tip_total = principal * (max(0.0, tip_pct) / 100.0)
        grand_total = principal + tip_total
        return {
            "mode": "split",
            "bill": round(principal, 2),
            "tip_amount": round(tip_total, 2),
            "grand_total": round(grand_total, 2),
            "per_person": round(grand_total / ppl, 2),
            "people": ppl,
        }

    months = max(1, min(int(months), 600))
    monthly_rate = (rate_annual_pct / 100.0) / 12.0

    if m == "loan":
        return calculate_loan_plan(principal, rate_annual_pct, months, monthly_extra_payment, repayment_method)

    if m == "goal":
        return calculate_savings_goal(principal, monthly_topup, target_amount, rate_annual_pct, months, inflation_annual_pct)

    # Default: compound interest deposit
    balance = principal
    invested = principal
    for _ in range(months):
        balance = balance * (1 + monthly_rate) + monthly_topup
        invested += monthly_topup
    profit = balance - invested
    return {
        "mode": "compound",
        "initial": round(principal, 2),
        "invested_total": round(invested, 2),
        "final_balance": round(balance, 2),
        "profit": round(profit, 2),
        "yield_pct": round((profit / max(1.0, invested)) * 100, 2),
        "months": months,
    }


def calculate_subnet(cidr_str: str) -> dict[str, Any]:
    raw = (cidr_str or "").strip()
    if "/" not in raw:
        raw = f"{raw}/24" if ":" not in raw else f"{raw}/64"
    net = ipaddress.ip_network(raw, strict=False)
    is_v4 = isinstance(net, ipaddress.IPv4Network)

    total_addrs = net.num_addresses
    if is_v4:
        if net.prefixlen <= 30:
            usable = max(0, total_addrs - 2)
            first_host = str(net.network_address + 1)
            last_host = str(net.broadcast_address - 1)
        elif net.prefixlen == 31:
            usable = 2
            first_host = str(net.network_address)
            last_host = str(net.broadcast_address)
        else:
            usable = 1
            first_host = str(net.network_address)
            last_host = str(net.network_address)
        mask_bits = ".".join(f"{b:08b}" for b in net.netmask.packed)
    else:
        usable = total_addrs
        first_host = str(net.network_address + 1) if total_addrs > 1 else str(net.network_address)
        last_host = str(net.broadcast_address)
        mask_bits = f"/{net.prefixlen}"

    return {
        "cidr": str(net),
        "version": f"IPv{net.version}",
        "network_address": str(net.network_address),
        "broadcast_address": str(net.broadcast_address),
        "netmask": str(net.netmask),
        "hostmask": str(net.hostmask),
        "prefixlen": net.prefixlen,
        "total_addresses": total_addrs,
        "usable_hosts": usable,
        "first_host": first_host,
        "last_host": last_host,
        "is_private": net.is_private,
        "binary_netmask": mask_bits,
    }
