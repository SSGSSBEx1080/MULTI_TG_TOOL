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


def calculate_finance(
    mode: str,
    principal: float,
    rate_annual_pct: float = 16.0,
    months: int = 12,
    monthly_topup: float = 0.0,
    people_count: int = 2,
    tip_pct: float = 10.0,
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
        if monthly_rate == 0:
            monthly_pay = principal / months
        else:
            factor = (1 + monthly_rate) ** months
            monthly_pay = principal * (monthly_rate * factor) / (factor - 1)
        total_paid = monthly_pay * months
        overpayment = total_paid - principal
        return {
            "mode": "loan",
            "principal": round(principal, 2),
            "months": months,
            "rate_pct": rate_annual_pct,
            "monthly_payment": round(monthly_pay, 2),
            "total_paid": round(total_paid, 2),
            "overpayment": round(overpayment, 2),
            "overpayment_pct": round((overpayment / max(1.0, principal)) * 100, 2),
        }

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
