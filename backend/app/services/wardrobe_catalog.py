"""稳定的用户明确选项目录；标签不据衣物类别或照片推断风格。"""

from app.schemas.garment import CatalogOption, WardrobeOptions

CATALOG_VERSION = "1"
CATEGORIES = {
    "tops": "上装",
    "bottoms": "下装",
    "dresses": "连衣裙",
    "outerwear": "外套",
    "shoes": "鞋履",
    "accessories": "配饰",
}
COLORS = {
    "black": "黑色",
    "white": "白色",
    "gray": "灰色",
    "beige": "米色",
    "brown": "棕色",
    "red": "红色",
    "orange": "橙色",
    "yellow": "黄色",
    "green": "绿色",
    "blue": "蓝色",
    "purple": "紫色",
    "pink": "粉色",
    "multicolor": "多色",
}
SEASONS = {"spring": "春季", "summer": "夏季", "autumn": "秋季", "winter": "冬季"}
OCCASIONS = {
    "daily": "日常",
    "work": "通勤",
    "sport": "运动",
    "formal": "正式",
    "travel": "旅行",
    "date": "约会",
}
STYLES = {
    "casual": "休闲",
    "minimal": "简约",
    "sporty": "运动",
    "elegant": "优雅",
    "street": "街头",
    "vintage": "复古",
}


def wardrobe_options() -> WardrobeOptions:
    def options(values: dict[str, str]) -> list[CatalogOption]:
        return [CatalogOption(id=key, label=label) for key, label in values.items()]

    return WardrobeOptions(
        version=CATALOG_VERSION,
        categories=options(CATEGORIES),
        colors=options(COLORS),
        seasons=options(SEASONS),
        occasions=options(OCCASIONS),
        styles=options(STYLES),
    )
