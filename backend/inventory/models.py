from django.db import models


class CarModel(models.Model):
    model_name = models.CharField(max_length=120)
    base_suffix = models.CharField(max_length=60, blank=True, default="")
    variant = models.CharField(max_length=120, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["model_name", "variant"]

    def __str__(self):
        bits = [self.model_name, self.variant, self.base_suffix]
        return " ".join(b for b in bits if b)
